/** Bouchon de @windy/fetch pour les tests : aucune requête, altitude du terrain inconnue */
export const getElevation = async (): Promise<{ data: number | null }> => ({ data: null });
export const getPointForecastData = async (): Promise<{ data: unknown }> => ({ data: null });
