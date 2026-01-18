import { CloudRain, Sun, Cloud, Snowflake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Weather, WeatherCondition } from "@shared/schema";

interface WeatherPanelProps {
  weather: Weather;
  isRaining: boolean;
  onRainChange: (checked: boolean) => void;
}

function CurrentWeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny':
      return <Sun className="h-5 w-5 text-warning" />;
    case 'cloudy':
      return <Cloud className="h-5 w-5 text-muted-foreground" />;
    case 'rainy':
      return <CloudRain className="h-5 w-5 text-primary" />;
    case 'snowy':
      return <Snowflake className="h-5 w-5 text-primary" />;
  }
}

const weatherLabels: Record<WeatherCondition, string> = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rainy: 'Rain',
  snowy: 'Snow',
};

export function WeatherPanel({ weather, isRaining, onRainChange }: WeatherPanelProps) {
  return (
    <Card className="p-4" data-testid="panel-weather">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-bold text-sm text-warning">Section A</span>
        <span className="text-sm font-bold">경기 환경</span>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        <CurrentWeatherIcon condition={weather.condition} />
        <span className="text-muted-foreground">
          현재: {weatherLabels[weather.condition]}, {weather.temperature}°C
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isRaining ? (
              <CloudRain className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-warning" />
            )}
            <Label 
              htmlFor="weather-switch"
              className="font-medium cursor-pointer text-sm"
            >
              비 오는 날씨
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">
            비가 오면 무승부 확률 +8%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRaining && (
            <span className="text-xs font-bold text-muted-foreground">무 +8%</span>
          )}
          <Switch
            id="weather-switch"
            checked={isRaining}
            onCheckedChange={onRainChange}
            data-testid="switch-weather"
          />
        </div>
      </div>
    </Card>
  );
}
