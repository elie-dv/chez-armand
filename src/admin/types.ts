export type AdminViewId = 'planning' | 'vehicules' | 'villages' | 'prospection' | 'jeunes' | 'messagerie';

export type AdminNavItem = {
  id: AdminViewId;
  label: string;
  icon: string;
};

export type AdminBadges = {
  villages: number;
  prospection: number;
  jeunes: number;
  messagerie: number;
};

export type AdminMetric = {
  label: string;
  value: number;
  helper: string;
};
