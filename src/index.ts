import {
  API,
  APIEvent,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  WithUUID
} from 'homebridge';
import mqtt from 'mqtt';
import { DafangMqttPlatformConfig, CameraConfig } from './configTypes';
const version = require('./package.json').version; // eslint-disable-line @typescript-eslint/no-var-requires

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-dafang-mqtt-republish';
const PLATFORM_NAME = 'dafangMqtt';

type Camera = {
  name: string;
  dafang_topic: string;
  cooldown: number;
  motion: boolean;
  timer?: NodeJS.Timeout;
};

class DafangMqttPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly config: DafangMqttPlatformConfig;
  private readonly accessories: Array<PlatformAccessory>;
  private readonly mqttUrl: string;
  private readonly homebridge_topic?: string;
  private readonly cameras: Array<Camera>;
  private client?: mqtt.MqttClient;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config as unknown as DafangMqttPlatformConfig;
    this.api = api;

    this.accessories = [];

    const server = config.server || '127.0.0.1';
    const port = config.port || '1883';
    this.mqttUrl = 'mqtt://' + server + ':' + port;

    if (config.homebridge_topic) {
      if(config.homebridge_topic == 'homebridge/motion') {
        this.homebridge_topic = 'homebridge';
      } else {
        this.homebridge_topic = config.homebridge_topic;
      }
    }

    const cameraConfigs = config.cameras || [];

    if (cameraConfigs.length == 0) {
      this.log.error('WARNING: No cameras configured.');
    }

    this.cameras = [];
    cameraConfigs.forEach((camera: CameraConfig) => {
      const newCamera = {
        name: camera.name,
        dafang_topic: camera.dafang_topic,
        cooldown: camera.cooldown || 0,
        motion: false,
        timer: undefined
      };

      this.log.info('Configuring "' + newCamera.name + '" on topic "' + newCamera.dafang_topic + '" with ' + (newCamera.cooldown > 0 ? newCamera.cooldown + ' second' : 'no') + ' cooldown.');

      let error = false;

      if (!newCamera.name) {
        this.log.warn('WARNING: No name set for this camera. It will not work unless this is corrected.');
        error = true;
      }

      if (!newCamera.dafang_topic) {
        this.log.warn('WARNING: No topic set for this camera. It will not work unless this is corrected.');
        error = true;
      }

      if (this.cameras.find(camera => camera.name === newCamera.name)) {
        this.log.warn('WARNING: Multiple cameras named "' + newCamera.name + '" configured. Only the first loaded will function.');
        error = true;
      }
      if (this.cameras.find(camera => camera.dafang_topic === newCamera.dafang_topic)) {
        this.log.warn('WARNING: Multiple cameras with topic "' + newCamera.dafang_topic + '" configured. Only the first loaded will function.');
        error = true;
      }

      if (!error) {
        this.cameras.push(newCamera);
      } else {
        this.log.warn('There was error with the config so this camera was ignored.');
      }
    });

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log('Configuring accessories for ' + accessory.displayName + '...');

    const config = this.config.cameras.find((camera: CameraConfig) => camera.name === accessory.displayName);

    if (!config || !config.accessories) {
      this.accessories.push(accessory);
      return;
    }

    const cameraAccessoryInfo = accessory.getService(hap.Service.AccessoryInformation);
    if (cameraAccessoryInfo) {
      cameraAccessoryInfo.updateCharacteristic(hap.Characteristic.Manufacturer, config.manufacturer || 'Dafang');
      cameraAccessoryInfo.updateCharacteristic(hap.Characteristic.Model, config.model || 'Hacks');
      cameraAccessoryInfo.updateCharacteristic(hap.Characteristic.SerialNumber, config.serialNumber || 'SerialNumber');
      cameraAccessoryInfo.updateCharacteristic(hap.Characteristic.FirmwareRevision, config.firmwareRevision || version);
    }

    let blueLedService = accessory.getServiceById(hap.Service.Lightbulb, '/leds/blue');
    let yellowLedService = accessory.getServiceById(hap.Service.Lightbulb, '/leds/yellow');
    let irLedService = accessory.getServiceById(hap.Service.Lightbulb, '/leds/ir');
    let irCutService = accessory.getServiceById(hap.Service.Switch, '/ir_cut');
    let brightnessService = accessory.getServiceById(hap.Service.LightSensor, '/brightness');
    let nightModeService = accessory.getServiceById(hap.Service.Switch, '/night_mode');
    let motionTrackingService = accessory.getServiceById(hap.Service.Switch, '/motion/tracking');
    let motorsUpService = accessory.getServiceById(hap.Service.Switch, '/motors/vertical/up');
    let motorsDownService = accessory.getServiceById(hap.Service.Switch, '/motors/vertical/down');
    let motorsLeftService = accessory.getServiceById(hap.Service.Switch, '/motors/horizontal/left');
    let motorsRightService = accessory.getServiceById(hap.Service.Switch, '/motors/horizontal/right');
    let recordingService = accessory.getServiceById(hap.Service.Switch, '/recording');
    let snapshotService = accessory.getServiceById(hap.Service.Switch, '/snapshot');

    if (blueLedService) {
      accessory.removeService(blueLedService);
    }
    if (yellowLedService) {
      accessory.removeService(yellowLedService);
    }
    if (irLedService) {
      accessory.removeService(irLedService);
    }
    if (irCutService) {
      accessory.removeService(irCutService);
    }
    if (brightnessService) {
      accessory.removeService(brightnessService);
    }
    if (nightModeService) {
      accessory.removeService(nightModeService);
    }
    if (motionTrackingService) {
      accessory.removeService(motionTrackingService);
    }
    if (motorsUpService) {
      accessory.removeService(motorsUpService);
    }
    if (motorsDownService) {
      accessory.removeService(motorsDownService);
    }
    if (motorsLeftService) {
      accessory.removeService(motorsLeftService);
    }
    if (motorsRightService) {
      accessory.removeService(motorsRightService);
    }
    if (recordingService) {
      accessory.removeService(recordingService);
    }
    if (snapshotService) {
      accessory.removeService(snapshotService);
    }

    if (config.accessories.blueLed) {
      blueLedService = new hap.Service.Lightbulb(config.name + ' Blue LED', '/leds/blue');
      blueLedService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/leds/blue/set', message);
          callback();
        });
      accessory.addService(blueLedService);
    }
    if (config.accessories.yellowLed) {
      yellowLedService = new hap.Service.Lightbulb(config.name + ' Yellow LED', '/leds/yellow');
      yellowLedService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/leds/yellow/set', message);
          callback();
        });
      accessory.addService(yellowLedService);
    }
    if (config.accessories.irLed) {
      irLedService = new hap.Service.Lightbulb(config.name + ' IR LED', '/leds/ir');
      irLedService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/leds/ir/set', message);
          callback();
        });
      accessory.addService(irLedService);
    }
    if (config.accessories.irCut) {
      irCutService = new hap.Service.Switch(config.name + ' IR Filter', '/ir_cut');
      irCutService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/ir_cut/set', message);
          callback();
        });
      accessory.addService(irCutService);
    }
    if (config.accessories.brightness) {
      brightnessService = new hap.Service.LightSensor(config.name + ' Brightness', '/brightness');
      accessory.addService(brightnessService);
    }
    if (config.accessories.nightMode) {
      nightModeService = new hap.Service.Switch(config.name + ' Night Mode', '/night_mode');
      nightModeService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/night_mode/set', message);
          callback();
        });
      accessory.addService(nightModeService);
    }
    if (config.accessories.motionTracking) {
      motionTrackingService = new hap.Service.Switch(config.name + ' Motion Tracking', '/motion/tracking');
      motionTrackingService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/motion/tracking/set', message);
          callback();
        });
      accessory.addService(motionTrackingService);
    }
    if (config.accessories.motorsVertical) {
      motorsUpService = new hap.Service.Switch(config.name + ' Tilt Up', '/motors/vertical/up');
      motorsUpService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          if (value) {
            this.publishMqtt(config.dafang_topic + '/motors/vertical/set', 'up');
            if (value) {
              setTimeout(() => {
                if (motorsUpService) {
                  motorsUpService.updateCharacteristic(hap.Characteristic.On, false);
                }
              }, 1000);
            }
          }
          callback();
        });
      accessory.addService(motorsUpService);
      motorsDownService = new hap.Service.Switch(config.name + ' Tilt Down', '/motors/vertical/down');
      motorsDownService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          if (value) {
            this.publishMqtt(config.dafang_topic + '/motors/vertical/set', 'down');
            if (value) {
              setTimeout(() => {
                if (motorsDownService) {
                  motorsDownService.updateCharacteristic(hap.Characteristic.On, false);
                }
              }, 1000);
            }
          }
          callback();
        });
      accessory.addService(motorsDownService);
    }
    if (config.accessories.motorsHorizontal) {
      motorsLeftService = new hap.Service.Switch(config.name + ' Pan Left', '/motors/horizontal/left');
      motorsLeftService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          if (value) {
            this.publishMqtt(config.dafang_topic + '/motors/horizontal/set', 'left');
            if (value) {
              setTimeout(() => {
                if (motorsLeftService) {
                  motorsLeftService.updateCharacteristic(hap.Characteristic.On, false);
                }
              }, 1000);
            }
          }
          callback();
        });
      accessory.addService(motorsLeftService);
      motorsRightService = new hap.Service.Switch(config.name + ' Pan Right', '/motors/horizontal/right');
      motorsRightService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          if (value) {
            this.publishMqtt(config.dafang_topic + '/motors/horizontal/set', 'right');
            if (value) {
              setTimeout(() => {
                if (motorsRightService) {
                  motorsRightService.updateCharacteristic(hap.Characteristic.On, false);
                }
              }, 1000);
            }
          }
          callback();
        });
      accessory.addService(motorsRightService);
    }
    if (config.accessories.recording) {
      recordingService = new hap.Service.Switch(config.name + ' Recording', '/recording');
      recordingService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          const message = value ? 'ON' : 'OFF';
          this.publishMqtt(config.dafang_topic + '/recording/set', message);
          callback();
        });
      accessory.addService(recordingService);
    }
    if (config.accessories.snapshot) {
      snapshotService = new hap.Service.Switch(config.name + ' Snapshot', '/snapshot');
      snapshotService.getCharacteristic(hap.Characteristic.On)
        .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          if (value) {
            this.publishMqtt(config.dafang_topic + '/snapshot/set', 'ON');
            if (value) {
              setTimeout(() => {
                if (snapshotService) {
                  snapshotService.updateCharacteristic(hap.Characteristic.On, false);
                }
              }, 1000);
            }
          }
          callback();
        });
      accessory.addService(snapshotService);
    }

    this.accessories.push(accessory);
  }

  didFinishLaunching(): void {
    this.config.cameras.forEach((camera: CameraConfig) => {
      if (camera.accessories) {
        if (!this.accessories.find((acc) => acc.displayName === camera.name)) {
          const uuid = hap.uuid.generate(camera.dafang_topic);
          const accessory = new Accessory(camera.name, uuid);
          this.configureAccessory(accessory);
          this.api.registerPlatformAccessories('homebridge-dafang-mqtt-republish', 'dafangMqtt', [accessory]);
        }
      }
    });

    this.accessories.forEach((accessory) => {
      const config = this.config.cameras.find((camera: CameraConfig) => camera.name === accessory.displayName);
      if (!config || !config.accessories) {
        this.api.unregisterPlatformAccessories('homebridge-dafang-mqtt-republish', 'dafangMqtt', [accessory]);
      }
    });

    this.connectMqtt();
  }

  publishMqtt(topic: string, message: string): void {
    this.log.debug('Publishing MQTT Message - ' + topic + ': ' + message);
    this.client?.publish(topic, message);
  }

  parseBoolMsg(message: string): boolean | undefined {
    switch (message) {
      case 'ON':
        return true;
      case 'OFF':
        return false;
      default:
        return undefined;
    }
  }

  handleMotion(camera: Camera, message: string): void {
    if (this.homebridge_topic) {
      const isOn = this.parseBoolMsg(message);
      if (isOn === undefined) {
        return;
      }
      if (isOn) {
        camera.motion = true;
        if (!camera.timer) {
          this.publishMqtt(this.homebridge_topic + '/motion', camera.name);
        } else {
          this.log.debug('Motion set received, but cooldown running: ' + camera.name);
        }
        if (camera.cooldown > 0) {
          if (camera.timer) {
            this.log.debug('Cancelling existing cooldown timer: ' + camera.name);
            clearTimeout(camera.timer);
          }
          this.log.debug('Cooldown enabled, starting timer: ' + camera.name);
          camera.timer = setTimeout(((): void => {
            this.log.debug('Cooldown finished, motion detected = ' + camera.motion + ': ' + camera.name);
            if (!camera.motion) {
              this.publishMqtt(this.homebridge_topic + '/motion/reset', camera.name);
            }
            camera.timer = undefined;
          }).bind(this), camera.cooldown * 1000);
        }
      } else {
        camera.motion = false;
        if (!camera.timer) {
          this.publishMqtt(this.homebridge_topic + '/motion/reset', camera.name);
        } else {
          this.log.debug('Motion clear received, but cooldown running: ' + camera.name);
        }
      }
    }
  }

  getService<T extends WithUUID<typeof Service>>(accessory: PlatformAccessory, type: string | T, subtype: string): Service | undefined {
    if (accessory) {
      return accessory.getServiceById(type, subtype);
    } else {
      return undefined;
    }
  }

  handleBoolService<T extends WithUUID<typeof Service>>(accessory: PlatformAccessory | undefined, type: string | T, subtype: string, message: string): void {
    if (accessory) {
      const service = this.getService(accessory, type, subtype);
      if (service) {
        const isOn = this.parseBoolMsg(message);
        if (isOn !== undefined) {
          service.updateCharacteristic(hap.Characteristic.On, isOn);
        }
      }
    }
  }

  handleBrightness(accessory: PlatformAccessory | undefined, message: string): void {
    if (accessory) {
      const value = Number.parseInt(message);
      if (Number.isNaN(value)) {
        return;
      }
      const service = this.getService(accessory, hap.Service.LightSensor, '/brightness');
      if (service) {
        const config = this.config.cameras.find((camera: CameraConfig) => camera.name === accessory.displayName);
        if (config?.accessories?.brightness) {
          switch (config.accessories.brightness) {
            case 'hw':
              service.updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, value);
              break;
            case 'virtual':
              service.updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, -0.0001 * value + 140);
              break;
          }
        }
      }
    }
  }

  connectMqtt(): void {
    this.client = mqtt.connect(this.mqttUrl);
    this.client.on('connect', () => {
      this.log('MQTT Connection Opened');
      this.cameras.forEach(camera => {
        this.client?.subscribe(camera.dafang_topic + '/#');
      });
    });
    this.client.on('message', (topic, message) => {
      const msg = message.toString();
      const camera = this.cameras.find(camera => topic.startsWith(camera.dafang_topic));
      if (camera) {
        const accessory = this.accessories.find((acc: PlatformAccessory) => acc.displayName === camera.name);
        const command = topic.substring(camera.dafang_topic.length);
        switch (command) {
          case '/motion':
            this.handleMotion(camera, msg);
            break;
          case '/leds/blue':
            this.handleBoolService(accessory, hap.Service.Lightbulb, '/leds/blue', msg);
            break;
          case '/leds/yellow':
            this.handleBoolService(accessory, hap.Service.Lightbulb, '/leds/yellow', msg);
            break;
          case '/leds/ir':
            this.handleBoolService(accessory, hap.Service.Lightbulb, '/leds/ir', msg);
            break;
          case '/ir_cut':
            this.handleBoolService(accessory, hap.Service.Switch, '/ir_cut', msg);
            break;
          case '/brightness':
            this.handleBrightness(accessory, msg);
            break;
          case '/night_mode':
            this.handleBoolService(accessory, hap.Service.Switch, '/night_mode', msg);
            break;
          case '/motion/tracking':
            this.handleBoolService(accessory, hap.Service.Switch, '/motion/tracking', msg);
            break;
          case '/recording':
            this.handleBoolService(accessory, hap.Service.Switch, '/recording', msg);
            break;
        }
      }
    });
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DafangMqttPlatform);
};