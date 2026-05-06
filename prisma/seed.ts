import { PrismaClient, TriggerSource } from "@prisma/client";

const prisma = new PrismaClient();

function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function generateSensorReading(
  baseDate: Date,
  hoursOffset: number,
  minutesOffset: number
) {
  const totalHoursOffset = hoursOffset + minutesOffset / 60;
  const hourOfDay = (baseDate.getHours() + totalHoursOffset + 24) % 24;

  const solarAngle = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
  const isDaytime = hourOfDay >= 6 && hourOfDay <= 20;
  const sunFactor = isDaytime ? Math.max(0, solarAngle) : 0;

  const ambientTemp = clamp(
    gaussianRandom(12 + sunFactor * 16, 1.5),
    5,
    32
  );

  const ambientHumidity = clamp(
    gaussianRandom(75 - sunFactor * 30, 5),
    35,
    90
  );

  const atmosphericPressure = clamp(
    gaussianRandom(1015, 3),
    1005,
    1025
  );

  const leafTemp = clamp(
    ambientTemp - gaussianRandom(1.5, 0.5),
    3,
    30
  );

  const soilHumidity = clamp(
    gaussianRandom(45 - sunFactor * 8, 4),
    25,
    60
  );

  const batteryLevel = clamp(
    gaussianRandom(87, 5),
    70,
    100
  );

  const rssi = Math.round(clamp(
    gaussianRandom(-65, 8),
    -90,
    -40
  ));

  const timestamp = new Date(baseDate);
  timestamp.setHours(timestamp.getHours() + hoursOffset);
  timestamp.setMinutes(timestamp.getMinutes() + minutesOffset);

  return {
    timestamp,
    ambientTemp: Math.round(ambientTemp * 10) / 10,
    ambientHumidity: Math.round(ambientHumidity * 10) / 10,
    atmosphericPressure: Math.round(atmosphericPressure * 10) / 10,
    leafTemp: Math.round(leafTemp * 10) / 10,
    soilHumidity: Math.round(soilHumidity * 10) / 10,
    batteryLevel: Math.round(batteryLevel * 10) / 10,
    rssi,
  };
}

function generateForecast(dayOffset: number) {
  const baseMaxTemps = [26, 28, 25, 27, 24, 23, 26];
  const baseMinTemps = [10, 12, 9, 11, 10, 8, 11];
  const basePrecip = [10, 5, 45, 30, 60, 20, 15];

  const maxTemp = clamp(
    gaussianRandom(baseMaxTemps[dayOffset], 2),
    18,
    35
  );

  const minTemp = clamp(
    gaussianRandom(baseMinTemps[dayOffset], 1.5),
    3,
    18
  );

  const precipitationProb = clamp(
    Math.round(gaussianRandom(basePrecip[dayOffset], 10)),
    0,
    100
  );

  const et0 = clamp(
    gaussianRandom(3.5 + (maxTemp - 25) * 0.15 - precipitationProb * 0.01, 0.5),
    1.0,
    7.0
  );

  const forecastDate = new Date();
  forecastDate.setDate(forecastDate.getDate() + dayOffset + 1);
  forecastDate.setHours(12, 0, 0, 0);

  return {
    forecastDate,
    maxTemp: Math.round(maxTemp * 10) / 10,
    minTemp: Math.round(minTemp * 10) / 10,
    precipitationProb,
    et0: Math.round(et0 * 100) / 100,
    fetchedAt: new Date(),
  };
}

async function main() {
  console.log("Seeding database...");

  await prisma.aiInteractionLog.deleteMany();
  await prisma.weatherForecast.deleteMany();
  await prisma.sensorData.deleteMany();
  await prisma.parcel.deleteMany();

  const parcel = await prisma.parcel.create({
    data: {
      name: "Viña Alta Rioja — Tempranillo",
      latitude: 42.4672,
      longitude: -2.4463,
      cropType: "Vitis vinifera (Tempranillo)",
    },
  });

  console.log(`Created parcel: ${parcel.name} (${parcel.id})`);

  const now = new Date();
  const sensorData = [];

  for (let h = 48; h >= 0; h--) {
    for (const m of [0, 30]) {
      if (h === 0 && m === 30) continue;

      const reading = generateSensorReading(now, -h, -m);
      sensorData.push({
        parcelId: parcel.id,
        ...reading,
      });
    }
  }

  const BATCH_SIZE = 20;
  for (let i = 0; i < sensorData.length; i += BATCH_SIZE) {
    const batch = sensorData.slice(i, i + BATCH_SIZE);
    await prisma.sensorData.createMany({ data: batch });
  }
  console.log(`Created ${sensorData.length} sensor data records`);

  const forecasts = [];
  for (let d = 0; d < 7; d++) {
    forecasts.push({
      parcelId: parcel.id,
      ...generateForecast(d),
    });
  }
  await prisma.weatherForecast.createMany({ data: forecasts });
  console.log(`Created ${forecasts.length} weather forecast records`);

  const sampleAiLog = await prisma.aiInteractionLog.create({
    data: {
      parcelId: parcel.id,
      timestamp: new Date(),
      triggerSource: TriggerSource.DASHBOARD_MANUAL,
      injectedContext: {
        parcel: parcel.name,
        cropType: parcel.cropType,
        latestSoilHumidity: sensorData[sensorData.length - 1].soilHumidity,
        latestAmbientTemp: sensorData[sensorData.length - 1].ambientTemp,
        forecastDays: 7,
      },
      prompt:
        "¿Cuál es el estado hídrico actual del viñedo y cuándo debo regar?",
      llmResponse:
        "El contenido de humedad del suelo se encuentra en torno al 42%, dentro del rango óptimo para Tempranillo en fase de crecimiento activo. Con las previsiones de precipitación de los próximos 3 días (probabilidad del 45-60%), se recomienda posponer el riego hasta evaluar las lluvias previstas. Si no se registran al menos 10mm en 48h, proceder con riego por goteo de 3mm.",
      tokensUsed: 247,
    },
  });
  console.log(`Created sample AI interaction log (${sampleAiLog.id})`);

  console.log("\nSeeding completed successfully!");
  console.log(`  Parcel:      ${parcel.name}`);
  console.log(`  SensorData:  ${sensorData.length} records (48h x 30min)`);
  console.log(`  Forecasts:   ${forecasts.length} days`);
  console.log(`  AI Logs:     1 sample record`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
