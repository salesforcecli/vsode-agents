/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import { satisfies, valid } from 'semver';
import {ExtensionContext, extensions, window} from 'vscode';
import {EXTENSION_NAME} from "../consts";
import {ChannelService} from "../types";
import {TelemetryService} from "../types/TelemetryService";
import {CoreExtensionApi} from "../types/CoreExtension";

const CORE_EXTENSION_ID='salesforce.salesforcedx-vscode-core'

export const NOT_INITIALIZED_ERROR = 'CoreExtensionService not initialized';
export const CHANNEL_SERVICE_NOT_FOUND = 'ChannelService not found';
export const TELEMETRY_SERVICE_NOT_FOUND = 'TelemetryService not found';
export const CORE_EXTENSION_NOT_FOUND = 'Core extension not found';
// export const APEX_EXTENSION_NOT_FOUND = 'Apex extension not found';
// export const WORKSPACE_CONTEXT_NOT_FOUND = 'Workspace Context not found';
// export const COMMAND_EVENT_DISPATCHER_NOT_FOUND = 'CommandEventDispatcher not found';
//
// export const MINIMUM_REQUIRED_CORE_VERSION_FOR_COMMAND_EVENT_DISPATCHER = 'v60.13.0';
// export const MINIMUM_REQUIRED_CORE_VERSION_FOR_SALESFORCE_PROJECT_CONFIG = 'v59.9.0';
// export const MINIMUM_REQUIRED_CORE_VERSION_FOR_GEN_TEST_CLASS_COMMAND_UPDATE = 'v60.12.0';
// export const MINIMUM_REQUIRED_APEX_VERSION_FOR_DOCUMENT_SYMBOLS = 'v62.5.0';

export class CoreExtensionService {
    private static initialized = false;
    private static channelService: ChannelService;
    private static telemetryService: TelemetryService;
    // private static workspaceContext: WorkspaceContext;
    // private static SalesforceProjectConfig: SalesforceProjectConfig | undefined;
    // private static commandEventDispatcher: CommandEventDispatcher;

    static loadDependencies(context: ExtensionContext) {
        if (!CoreExtensionService.initialized) {
            const coreExtensionApi = CoreExtensionService.validateCoreExtension();

            CoreExtensionService.initializeChannelService(coreExtensionApi?.services.ChannelService);
            CoreExtensionService.initializeTelemetryService(coreExtensionApi?.services.TelemetryService, context);
            // CoreExtensionService.initializeWorkspaceContext(coreExtensionApi?.services.WorkspaceContext);
            // CoreExtensionService.initializeCommandEventDispatcher(coreExtensionApi?.services.CommandEventDispatcher);

            // verify the apex plugin version
            // CoreExtensionService.validateApexExtension();

            // CoreExtensionService.initializeSalesforceProjectConfig(coreExtensionApi?.services.SalesforceProjectConfig);
            CoreExtensionService.initialized = true;
        }
    }

    public static getCoreExtensionVersion(): string {
        const coreExtension = extensions.getExtension(CORE_EXTENSION_ID);
        if (!coreExtension) {
            throw new Error(CORE_EXTENSION_NOT_FOUND);
        }
        return coreExtension.packageJSON.version;
    }

    private static validateCoreExtension(): CoreExtensionApi {
        const coreExtension = extensions.getExtension(CORE_EXTENSION_ID);
        if (!coreExtension) {
            throw new Error(CORE_EXTENSION_NOT_FOUND);
        }
        const coreExtensionVersion = CoreExtensionService.getCoreExtensionVersion();
        if (
            !CoreExtensionService.isAboveMinimumRequiredVersion('60.13.0', coreExtensionVersion)
        ) {
            throw new Error("It looks you're running an older version of the Salesforce CLI Integration VSCode Extension. Update the Salesforce Extension pack and try again.");
        }
        return coreExtension.exports;
    }

    // public static getApexExtensionVersion(): string {
    //     const apexExtension = extensions.getExtension(APEX_EXTENSION_ID);
    //     if (!apexExtension) {
    //         throw new Error(APEX_EXTENSION_NOT_FOUND);
    //     }
    //     return apexExtension.packageJSON.version;
    // }

    // private static validateApexExtension() {
    //     const apexExtensionVersion = CoreExtensionService.getApexExtensionVersion();
    //     if (
    //         !CoreExtensionService.isAboveMinimumRequiredVersion(MINIMUM_REQUIRED_VERSION_APEX_EXTENSION, apexExtensionVersion)
    //     ) {
    //         throw new DependencyError(getLocalization(LocalizationKeys.apexExtensionMinRequiredVersionError));
    //     }
    // }

    private static initializeChannelService(channelService: ChannelService | undefined) {
        if (!channelService) {
            throw new Error(CHANNEL_SERVICE_NOT_FOUND);
        }
        CoreExtensionService.channelService = channelService.getInstance(EXTENSION_NAME);
    }

    private static initializeTelemetryService(telemetryService: TelemetryService | undefined, context: ExtensionContext) {
        if (!telemetryService) {
            throw new Error(TELEMETRY_SERVICE_NOT_FOUND);
        }
        const { aiKey, name, version } = context.extension.packageJSON;
        CoreExtensionService.telemetryService = telemetryService.getInstance(name);
        CoreExtensionService.telemetryService.initializeService(context, name, aiKey, version);
    }

    // private static initializeWorkspaceContext(workspaceContext: WorkspaceContext | undefined) {
    //     if (!workspaceContext) {
    //         throw new Error(WORKSPACE_CONTEXT_NOT_FOUND);
    //     }
    //     CoreExtensionService.workspaceContext = workspaceContext.getInstance(false);
    // }

    // private static initializeSalesforceProjectConfig(SalesforceProjectConfig: SalesforceProjectConfig | undefined) {
    //     if (!SalesforceProjectConfig) {
    //         logger.debug(
    //             `SalesforceProjectConfig not found in core extension APIs due to an incorrect version of the core extension (minimum required version: ${MINIMUM_REQUIRED_CORE_VERSION_FOR_SALESFORCE_PROJECT_CONFIG}).`
    //         );
    //     }
    //     CoreExtensionService.SalesforceProjectConfig = SalesforceProjectConfig;
    // }

    // private static initializeCommandEventDispatcher(commandEventDispatcher: CommandEventDispatcher) {
    //     if (!commandEventDispatcher) {
    //         console.log(
    //             `CommandEventDispatcher not found in core extension APIs due to an incorrect version of the core extension (minimum required version: ${MINIMUM_REQUIRED_CORE_VERSION_FOR_COMMAND_EVENT_DISPATCHER}).`
    //         );
    //         throw new Error(COMMAND_EVENT_DISPATCHER_NOT_FOUND);
    //     }
    //     CoreExtensionService.commandEventDispatcher = commandEventDispatcher.getInstance();
    // }

    public static isAboveMinimumRequiredVersion(minRequiredVersion: string, actualVersion: string):boolean {
        // Check to see if version is in the expected MAJOR.MINOR.PATCH format
        if (!valid(actualVersion)) {
          void  window.showWarningMessage(`Invalid version format found for the Core Extension ${actualVersion} < ${minRequiredVersion}`);
        }
        return satisfies(actualVersion, '>=' + minRequiredVersion);
    }

    static getChannelService(): ChannelService {
        if (CoreExtensionService.initialized) {
            return CoreExtensionService.channelService;
        }
        throw new Error(NOT_INITIALIZED_ERROR);
    }

    static getTelemetryService(): TelemetryService {
        if (CoreExtensionService.initialized) {
            return CoreExtensionService.telemetryService;
        }
        throw new Error(NOT_INITIALIZED_ERROR);
    }

    // static getWorkspaceContext(): WorkspaceContext {
    //     if (CoreExtensionService.initialized) {
    //         return CoreExtensionService.workspaceContext;
    //     }
    //     throw new Error(NOT_INITIALIZED_ERROR);
    // }

    // static getSalesforceProjectConfig(): SalesforceProjectConfig | undefined {
    //     if (CoreExtensionService.initialized) {
    //         return CoreExtensionService.SalesforceProjectConfig;
    //     }
    //     logger.debug('CoreExtensionService not initialized');
    //     return undefined;
    // }

    // static getCommandEventDispatcher(): CommandEventDispatcher {
    //     if (CoreExtensionService.initialized) {
    //         return CoreExtensionService.commandEventDispatcher;
    //     }
    //     throw new Error(NOT_INITIALIZED_ERROR);
    // }

    // static async getWorkspaceOrgId(): Promise<string> {
    //     if (CoreExtensionService.initialized) {
    //         const connection = await CoreExtensionService.workspaceContext.getConnection();
    //         return connection?.getAuthInfoFields().orgId ?? '';
    //     }
    //     throw new Error(NOT_INITIALIZED_ERROR);
    // }

    // static async getWorkspaceUsername(): Promise<string> {
    //     if (CoreExtensionService.initialized) {
    //         const connection = await CoreExtensionService.workspaceContext.getConnection();
    //         return connection.getUsername() ?? '';
    //     }
    //     throw new Error(NOT_INITIALIZED_ERROR);
    // }
}
