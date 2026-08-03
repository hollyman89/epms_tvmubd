export declare enum DashboardPeriod {
    THIS_MONTH = "THIS_MONTH",
    LAST_QUARTER = "LAST_QUARTER",
    YEAR_TO_DATE = "YEAR_TO_DATE",
    LAST_MONTH = "LAST_MONTH",
    THIS_QUARTER = "THIS_QUARTER",
    CUSTOM = "CUSTOM"
}
export declare class GetAnalyticsQueryDto {
    period?: DashboardPeriod;
    startDate?: string;
    endDate?: string;
}
