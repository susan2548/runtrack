import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Home: undefined;
  Track: { routePlanId?: string } | undefined;
  Progress: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  History: undefined;
  ActivityDetail: { activityId: string };
  ActivityEditor: { activityId: string; afterFinish: boolean };
  Heatmap: undefined;
  RoutePlanner: undefined;
};

/** Kept as an alias for platform-specific detail screens created before the root-stack refactor. */
export type HistoryStackParamList = {
  HistoryList: undefined;
  ActivityDetail: { activityId: string };
};
