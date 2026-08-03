import {
  AppstoreOutlined,
  CarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  DollarOutlined,
  EditOutlined,
  FundOutlined,
  GiftOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  PieChartOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RedEnvelopeOutlined,
  ShoppingCartOutlined,
  TrophyOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

import type { CategoryIcon } from './category';

export type PrimaryNavKey = 'home' | 'entries' | 'create' | 'statistics' | 'profile';

export const primaryNavigationIcons: Record<PrimaryNavKey, Component> = {
  home: HomeOutlined,
  entries: UnorderedListOutlined,
  create: EditOutlined,
  statistics: PieChartOutlined,
  profile: UserOutlined,
};

export const categoryIcons: Record<CategoryIcon, Component> = {
  food: CoffeeOutlined,
  shopping: ShoppingCartOutlined,
  transport: CarOutlined,
  housing: HomeOutlined,
  entertainment: PlayCircleOutlined,
  medical: MedicineBoxOutlined,
  education: ReadOutlined,
  gift: GiftOutlined,
  salary: DollarOutlined,
  bonus: TrophyOutlined,
  part_time: ClockCircleOutlined,
  investment: FundOutlined,
  red_packet: RedEnvelopeOutlined,
  refund: UndoOutlined,
  other: AppstoreOutlined,
};
