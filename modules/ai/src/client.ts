import axios, { AxiosInstance } from 'axios';
import logger from '@bot/logger';
import { clinicKnowledge, KnowledgeItem } from './knowledge';

export interface AiClientConfig {
  apiKey?: string;
  model?: string;
  appUrl?: string;
  appName?: string;
}

export interface AiAnswer {
  answer: string;
  sources: Pick<KnowledgeItem, 'id' | 'title' | 'category'>[];
  mode: 'local' | 'openrouter';
}

export class ClinicAiClient {
  private client?: AxiosInstance;
  private model: string;
  private failureCount = 0;
  private circuitOpenedUntil = 0;
  private readonly failureThreshold = 3;
  private readonly circuitOpenMs = 60_000;

  constructor(private config: AiClientConfig = {}) {
    this.model = config.model || 'openai/gpt-4o-mini';

    if (config.apiKey) {
      this.client = axios.create({
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.appUrl || 'https://clinic-bot.local',
          'X-Title': config.appName || 'Clinic Bot',
        },
        timeout: 20_000,
      });
    }
  }

  async answer(question: string, locale = 'ru'): Promise<AiAnswer> {
    const sources = this.retrieve(question);

    if (!this.client || Date.now() < this.circuitOpenedUntil) {
      return this.localAnswer(question, sources, locale);
    }

    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Ты администратор клиники. Отвечай кратко, только на основе контекста. Не ставь диагнозы, не назначай лечение и при медицинском риске направляй к специалисту.',
          },
          {
            role: 'user',
            content: [
              `Вопрос клиента: ${question}`,
              '',
              'Контекст базы знаний:',
              sources.map((item) => `- ${item.title}: ${item.content}`).join('\n'),
            ].join('\n'),
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      this.recordSuccess();
      return {
        answer: response.data.choices?.[0]?.message?.content || this.localAnswer(question, sources, locale).answer,
        sources: sources.map(({ id, title, category }) => ({ id, title, category })),
        mode: 'openrouter',
      };
    } catch (error) {
      this.recordFailure();
      logger.error('OpenRouter request failed; falling back to local AI answer', error);
      return this.localAnswer(question, sources, locale);
    }
  }

  retrieve(query: string, limit = 3): KnowledgeItem[] {
    const tokens = this.tokenize(query);
    const ranked = clinicKnowledge
      .map((item) => ({
        item,
        score: this.scoreItem(item, tokens),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);

    return ranked.length ? ranked : clinicKnowledge.filter((item) => item.category === 'safety').slice(0, 1);
  }

  private localAnswer(question: string, sources: KnowledgeItem[], locale: string): AiAnswer {
    const intro = locale === 'en'
      ? 'I can answer only from the clinic knowledge base.'
      : locale === 'ua'
        ? 'Я можу відповідати тільки на основі бази знань клініки.'
        : 'Отвечаю только на основе базы знаний клиники.';

    const body = sources.map((item) => `${item.title}: ${item.content}`).join('\n\n');
    const safety = locale === 'en'
      ? 'For diagnosis, prescriptions or contraindications, please contact a clinic specialist.'
      : locale === 'ua'
        ? 'Для діагнозу, призначень або протипоказань зверніться до спеціаліста клініки.'
        : 'По диагнозам, назначениям и противопоказаниям нужно обратиться к специалисту клиники.';

    return {
      answer: `${intro}\n\n${body}\n\n${safety}`,
      sources: sources.map(({ id, title, category }) => ({ id, title, category })),
      mode: 'local',
    };
  }

  private tokenize(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-zа-яёіїєґ0-9\s-]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private scoreItem(item: KnowledgeItem, tokens: string[]) {
    const haystack = `${item.title} ${item.category} ${item.tags.join(' ')} ${item.content}`.toLowerCase();
    return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
  }

  private recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenedUntil = 0;
  }

  private recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.circuitOpenedUntil = Date.now() + this.circuitOpenMs;
    }
  }
}
