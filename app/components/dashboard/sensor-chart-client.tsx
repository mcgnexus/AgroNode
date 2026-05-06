"use client";

import DualAxisSensorChart from "./sensor-chart";

export default function SensorChartClient(props: { data: Parameters<typeof DualAxisSensorChart>[0]["data"] }) {
  return <DualAxisSensorChart {...props} />;
}
