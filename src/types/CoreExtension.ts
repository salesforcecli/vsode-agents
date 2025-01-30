import { ChannelService } from './ChannelService';
import { TelemetryService } from './TelemetryService';

export interface CoreExtensionApi {
  services: {
    ChannelService: ChannelService;
    TelemetryService: TelemetryService;
  };
}
