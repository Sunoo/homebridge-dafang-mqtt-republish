import { PlatformIdentifier, PlatformName } from 'homebridge';

export type DafangMqttPlatformConfig = {
  platform: PlatformName | PlatformIdentifier;
  name?: string;
  server?: string;
  port?: number;
  tls?: number;
  cameras?: Array<CameraConfig>;
};

export type CameraConfig = {
  name?: string;
  dafang_topic?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareRevision?: string;
  accessories?: AccessoriesConfig;
};

export type AccessoriesConfig = {
  blueLed?: boolean;
  yellowLed?: boolean;
  irLed?: boolean;
  irCut?: boolean;
  nightMode?: boolean;
  motionTracking?: boolean;
  motorsVertical?: boolean;
  motorsHorizontal?: boolean;
  motorsCalibrate?: boolean;
  recording?: boolean;
  snapshot?: boolean;
  brightness?: string;
  rtsp_mjpeg_server?: boolean;
  rtsp_h264_server?: boolean;
  remount_sdcard?: boolean;
  reboot?: boolean;
};