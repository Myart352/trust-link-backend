import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aggregates escrow, volume, participant, and dispute totals for admins
   *  using database-level aggregates instead of loading all rows into memory. */
  async getStats(): Promise<AdminStatsDto> {
    const [
      totalEscrows,
      totalVolumeResult,
      stateGroups,
      vendorGroups,
      buyerGroups,
      totalDisputes,
      openDisputes,
    ] = await Promise.all([
      this.prisma.escrow.count({}),
      this.prisma.escrow.aggregate({ _sum: { amount: true } }),
      this.prisma.escrow.groupBy({
        by: ['state'],
        _count: { state: true },
      }),
      this.prisma.escrow.groupBy({ by: ['vendorAddress'] }),
      this.prisma.escrow.groupBy({ by: ['buyerAddress'] }),
      this.prisma.dispute.count({}),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    const totalVolume = totalVolumeResult._sum.amount ?? 0;

    const escrowsByState: Record<string, number> = {};
    for (const group of stateGroups) {
      const state = group.state as string;
      const count = (group._count as { state: number }).state;
      escrowsByState[state] = count;
    }

    const uniqueVendors = vendorGroups.length;
    const uniqueBuyers = buyerGroups.length;

    const averageEscrowAmount =
      totalEscrows > 0 ? totalVolume / totalEscrows : 0;

    return {
      totalEscrows,
      totalVolume,
      escrowsByState,
      uniqueVendors,
      uniqueBuyers,
      totalDisputes,
      openDisputes,
      averageEscrowAmount,
    };
  }
}
