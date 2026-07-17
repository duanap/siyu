import { apiRequest } from './api';

export interface StatisticsOverview {
  ledgerId: string;
  ledgerType: 'PERSONAL' | 'COUPLE';
  month: string;
  incomeCent: number;
  expenseCent: number;
  balanceCent: number;
  averageDailyExpenseCent: number;
  largestExpenseCent: number;
  entryCount: number;
}

export interface StatisticsTrendItem {
  date: string;
  incomeCent: number;
  expenseCent: number;
}

export interface StatisticsTrend {
  ledgerId: string;
  ledgerType: 'PERSONAL' | 'COUPLE';
  month: string;
  items: StatisticsTrendItem[];
}

export interface StatisticsCategoryItem {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  isEnabled: boolean;
  amountCent: number;
  basisPoints: number;
  entryCount: number;
}

export interface StatisticsCategories {
  ledgerId: string;
  ledgerType: 'PERSONAL' | 'COUPLE';
  month: string;
  type: 'EXPENSE';
  totalCent: number;
  items: StatisticsCategoryItem[];
}

export interface StatisticsMemberItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  memberStatus: 'ACTIVE' | 'LEFT';
  isCurrentUser: boolean;
  amountCent: number;
  basisPoints: number;
  entryCount: number;
}

export interface StatisticsMembers {
  ledgerId: string;
  ledgerType: 'PERSONAL' | 'COUPLE';
  month: string;
  totalCent: number;
  items: StatisticsMemberItem[];
}

function query(ledgerId: string, month: string): string {
  return new URLSearchParams({ ledgerId, month }).toString();
}

export const statisticsApi = {
  overview(ledgerId: string, month: string, accessToken?: string): Promise<StatisticsOverview> {
    return apiRequest(`/statistics/overview?${query(ledgerId, month)}`, accessToken);
  },
  trend(ledgerId: string, month: string, accessToken?: string): Promise<StatisticsTrend> {
    return apiRequest(`/statistics/trend?${query(ledgerId, month)}`, accessToken);
  },
  categories(ledgerId: string, month: string, accessToken?: string): Promise<StatisticsCategories> {
    return apiRequest(`/statistics/categories?${query(ledgerId, month)}`, accessToken);
  },
  members(ledgerId: string, month: string, accessToken?: string): Promise<StatisticsMembers> {
    return apiRequest(`/statistics/members?${query(ledgerId, month)}`, accessToken);
  },
};
