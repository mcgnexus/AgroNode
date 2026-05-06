import AemetHourlyWidget from "@/app/components/dashboard/aemet-hourly-widget";
import { getAemetHourlyForecast } from "@/lib/data-fetching";

export default async function AemetHourlySection({ parcelId }: { parcelId: string }) {
  const { data, municipio } = await getAemetHourlyForecast(parcelId);

  const grouped = new Map<string, typeof data>();
  for (const h of data) {
    const key = h.forecastDate.toISOString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }

  const days = Array.from(grouped.entries()).map(([date, hours]) => ({
    date,
    hours: hours.map(h => ({
      hour: h.hour,
      temperature: h.temperature,
      precipitationProb: h.precipitationProb,
      humidity: h.humidity,
      windSpeed: h.windSpeed,
      windDirection: h.windDirection,
      skyState: h.skyState,
    })),
  }));

  return <AemetHourlyWidget data={days} municipio={municipio} />;
}
