# homebridge-dafang-mqtt-republish

[![npm](https://img.shields.io/npm/v/homebridge-dafang-mqtt-republish) ![npm](https://img.shields.io/npm/dt/homebridge-dafang-mqtt-republish)](https://www.npmjs.com/package/homebridge-dafang-mqtt-republish) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This plugin republishes MQTT motion messages from [Dafang Hacks](https://github.com/EliasKotlyar/Xiaomi-Dafang-Hacks) into a format [homebridge-camera-ffmpeg](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg) understands.

## Installation

> More detailed setup instructions available [in the wiki](https://github.com/Sunoo/homebridge-dafang-mqtt-republish/wiki/Configuring-Dafang-Hacks-Cameras-for-Homebridge).

1. Install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).
2. Install homebridge-camera-ffmpeg using `sudo npm install -g homebridge-camera-ffmpeg --unsafe-perm`.
3. Install this plugin using `sudo npm install -g homebridge-dafang-mqtt-republish`.
4. Update your configuration file. See configuration sample below.

### Configuration

Edit your `config.json` accordingly. Configuration sample:

 ```json
"platforms": [
    {
        "platform": "dafangMqtt",
        "server": "10.0.1.190",
        "port": 1883,
        "homebridge_topic": "homebridge",
        "cameras": [
            {
                "name": "Cat Food Camera",
                "dafang_topic": "dafang/catcam"
            }
        ]
    }
]
```

- `server`: The address of your MQTT server. (Default: 127.0.0.1)
- `port`: The port of your MQTT server. (Default: 1883)
- `tls`: Use TLS to connect to the MQTT server. (Default: false)
- `homebridge_topic`: MQTT topic that homebridge-camera-ffmpeg is subscribed to. If not set, motion alerts will not be passed on.
- `cameras`: _(Required)_ Array of Dafang Hacks camera configs (multiple supported).
  - `name`: _(Required)_ Name of your camera. (Needs to be the same as in homebridge-camera-ffmpeg config)
  - `dafang_topic`: _(Required)_ MQTT topic that your camera publishes to. (Must be unique per camera)
  - `cooldown`: Follow cooldown defined in the Homebridge Camera FFmpeg config. (Default: false)
  - `manufacturer`: Manufacturer for exposed accessories.
  - `model`: Model for exposed accessories.
  - `serialNumber`: Serial number for exposed accessories.
  - `firmwareRevision`: Firmware revision for exposed accessories.
  - `accessories`
    - `blueLed`: Exposes blue LED as a lightbulb.
    - `yellowLed`: Exposes yellow LED as a lightbulb.
    - `irLed`: Exposes IR LED as a lightbulb.
    - `irCut`: Exposes IR filter as a switch.
    - `brightness`: Exposes brightness as a light sensor. Can be set to either `hw` or `virtual` and should match what your camera is configured to use. `virtual` is experimental and the values are unlikely to be accurate or useful.
    - `nightMode`: Exposes night mode as a switch.
    - `motionTracking`: Exposes motion tracking as a switch.
    - `motorsVertical`: Exposes tilting up and down as switches.
    - `motorsHorizontal`: Exposes panning left and right as switches.
    - `motorsCalibrate`: Exposes calibration as a switch.
    - `recording`: Exposes video recording as a switch.
    - `snapshot`: Exposes snapshot as a switch.
    - `rtsp_mjpeg_server`: Exposes RTSP MJPEG server as a switch.
    - `rtsp_h264_server`: Exposes RTSP H264 server as a switch.
    - `remount_sdcard`: Exposes remounting SD card as a switch.
    - `reboot`: Exposes rebooting as a switch.
