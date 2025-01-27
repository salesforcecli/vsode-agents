import { ChannelService } from './ChannelService';
import { TelemetryService } from './TelemetryService';

export interface CoreExtensionApi {
    services: {
        ChannelService: ChannelService;
        // SalesforceProjectConfig: SalesforceProjectConfig;
        TelemetryService: TelemetryService;
        // WorkspaceContext: WorkspaceContext;
        // CommandEventDispatcher: CommandEventDispatcher;
    };
}
