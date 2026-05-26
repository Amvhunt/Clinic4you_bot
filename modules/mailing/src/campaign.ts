import prisma from '@bot/database';
import logger from '@bot/logger';
import { enqueueNotification } from '@bot/notifications';

export type CampaignAudience = 'all' | 'marketing_opt_in' | 'active_clients';

export interface CreateCampaignInput {
  title: string;
  message: string;
  audience: CampaignAudience;
  createdBy?: string;
  dryRun?: boolean;
}

export interface CampaignResult {
  campaignId?: string;
  recipients: number;
  queued: number;
  dryRun: boolean;
}

export class MailingService {
  async createAndQueueCampaign(input: CreateCampaignInput): Promise<CampaignResult> {
    const users = await this.findRecipients(input.audience);

    if (input.dryRun) {
      return {
        recipients: users.length,
        queued: 0,
        dryRun: true,
      };
    }

    const campaign = await prisma.mailingCampaign.create({
      data: {
        title: input.title,
        message: input.message,
        audience: input.audience,
        createdBy: input.createdBy,
        status: 'queued',
        recipientCount: users.length,
      },
    });

    let queued = 0;
    for (const user of users) {
      await enqueueNotification({
        telegramUserId: user.telegramId,
        type: 'marketing',
        content: input.message,
        locale: user.locale,
        metadata: {
          campaignId: campaign.id,
          audience: input.audience,
        },
      });
      queued += 1;
    }

    await prisma.mailingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    logger.info('Mailing campaign queued', {
      campaignId: campaign.id,
      recipients: users.length,
      queued,
    });

    return {
      campaignId: campaign.id,
      recipients: users.length,
      queued,
      dryRun: false,
    };
  }

  async listRecentCampaigns(limit = 5) {
    return prisma.mailingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async findRecipients(audience: CampaignAudience) {
    if (audience === 'marketing_opt_in') {
      return prisma.user.findMany({
        where: {
          deletedAt: null,
          preferences: {
            marketingEmails: true,
          },
        },
      });
    }

    if (audience === 'active_clients') {
      return prisma.user.findMany({
        where: {
          deletedAt: null,
          appointments: {
            some: {
              status: {
                not: 'cancelled',
              },
            },
          },
        },
      });
    }

    return prisma.user.findMany({
      where: { deletedAt: null },
    });
  }
}
