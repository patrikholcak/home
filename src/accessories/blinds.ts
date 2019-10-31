import {
  Accessory as HAPAccessory,
  AccessoryEventTypes,
  Characteristic,
  CharacteristicEventTypes,
  NodeCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Service,
  uuid,
  VoidCallback,
} from "hap-nodejs";
import {
  TradfriClient,
  Accessory as IkeaAccessory,
  DeviceUpdatedCallback,
} from "node-tradfri-client";

const connectGateway = async (
  host: string,
  securityCode: string,
  onDeviceUpdated: DeviceUpdatedCallback
) => {
  const gateway = new TradfriClient(host);

  gateway.on("device updated", onDeviceUpdated);

  const { identity, psk } = await gateway.authenticate(securityCode);
  const connected = await gateway.connect(identity, psk);

  if (!connected) throw new Error("Could not connect.");

  await gateway.observeDevices();

  return gateway;
};

class BlindAccessory {
  position: number = 0;
  previousPosition: number = this.position;
  targetPosition: number = this.position;

  batteryLevel: number = 100;
  lowBatteryLimit = 10;

  // @ts-ignore
  gateway: TradfriClient;
  accessory: HAPAccessory;
  //@ts-ignore
  device: IkeaAccessory;
  battery: Service;

  constructor(accessory: HAPAccessory) {
    this.accessory = accessory;
    this.connectGateway();

    this.accessory.addService(Service.WindowCovering, "Blind");
    this.battery = this.accessory.addService(Service.BatteryService);

    this.enablePosition();
    this.enableTargetPosition();
    this.enableBattery();
    this.previousPosition = this.position;
  }

  connectGateway = async () => {
    this.gateway = await connectGateway(
      "TRADFRI-Gateway-4491602cec17.local",
      "tiiyhgOey5j6VTIS",
      this.deviceChanged
    );
  };

  deviceChanged(device: IkeaAccessory) {
    if (!device.blindList) return;

    this.device = device;

    this.updatePosition();
    this.updateBatteryLevel();
    this.estimateTargetPositionIfNeeded();
    this.previousPosition = this.position;
  }

  enablePosition() {
    this.accessory
      .getService(Service.WindowCovering)!
      .getCharacteristic(Characteristic.CurrentPosition)!
      .on(
        CharacteristicEventTypes.GET,
        (callback: NodeCallback<CharacteristicValue>) => {
          callback(null, this.position);
        }
      );

    this.updatePosition();
  }

  enableTargetPosition() {
    this.accessory
      .getService(Service.WindowCovering)!
      .getCharacteristic(Characteristic.TargetPosition)!
      .on(
        CharacteristicEventTypes.GET,
        (callback: NodeCallback<CharacteristicValue>) => {
          callback(null, this.targetPosition);
        }
      )
      .on(CharacteristicEventTypes.SET, this.setTargetPosition);

    this.updateTargetPosition(this.position);
  }

  enableBattery() {
    this.battery
      .getCharacteristic(Characteristic.BatteryLevel)!
      .on(
        CharacteristicEventTypes.GET,
        (callback: NodeCallback<CharacteristicValue>) => {
          callback(null, this.device.deviceInfo.battery);
        }
      );

    this.battery
      .getCharacteristic(Characteristic.StatusLowBattery)!
      .on(
        CharacteristicEventTypes.GET,
        (callback: NodeCallback<CharacteristicValue>) => {
          let battery = this.device.deviceInfo.battery;
          callback(null, battery <= this.lowBatteryLimit);
        }
      );
  }

  setTargetPosition(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) {
    const numberValue = Number(value);

    console.log(
      "Setting target position to %s on blind '%s'",
      value,
      this.device.deviceInfo.serialNumber
    );

    this.position = numberValue;
    this.targetPosition = numberValue;

    this.gateway
      .operateBlind(this.device, {
        position: 100 - numberValue,
      })
      .then(() => {
        if (callback) callback();
      });
  }

  estimateTargetPositionIfNeeded() {
    let position = this.position;
    let increasing =
      this.previousPosition < position && this.targetPosition < position;
    let decreasing =
      this.previousPosition > position && this.targetPosition > position;
    if (increasing) {
      this.updateTargetPosition(100);
    } else if (decreasing) {
      this.updateTargetPosition(0);
    }

    setTimeout(() => {
      // If no new position we can assume that blinds has been stopped
      if (this.position === position) {
        this.updateTargetPosition(this.position);
      }
    }, 2000);
  }

  updatePosition() {
    const blind = this.device.blindList[0];
    const position = this.accessory
      .getService(Service.WindowCovering)!
      .getCharacteristic(Characteristic.CurrentPosition)!;
    this.position = 100 - blind.position;
    console.log(
      "Updating position to %s on blind '%s'",
      this.position,
      this.device.deviceInfo.serialNumber
    );
    position.updateValue(this.position);
  }

  updateTargetPosition(position: number) {
    const targetPosition = this.accessory
      .getService(Service.WindowCovering)!
      .getCharacteristic(Characteristic.TargetPosition)!;
    this.targetPosition = position;
    console.log(
      "Updating target position to %s on blind '%s'",
      this.targetPosition,
      this.device.deviceInfo.serialNumber
    );
    targetPosition.updateValue(this.targetPosition);
  }

  updateBatteryLevel() {
    const lowBatteryStatus = this.accessory
      .getService(Service.WindowCovering)!
      .getCharacteristic(Characteristic.StatusLowBattery)!;
    this.batteryLevel = this.device.deviceInfo.battery;
    console.log(
      "Updating battery level to %s on blind '%s'",
      this.batteryLevel,
      this.device.deviceInfo.serialNumber
    );
    lowBatteryStatus.updateValue(this.batteryLevel <= this.lowBatteryLimit);
  }

  getAccessory = () => this.accessory;
}

const blindUUID = uuid.generate("com-patrikolcak:accessories:Blind");
const blind = new HAPAccessory("TRADFRI blind", blindUUID);

// @ts-ignore
blind.username = "54:3E:B6:91:00:EB";
// @ts-ignore
blind.pincode = "031-45-154";

blind
  .getService(Service.AccessoryInformation)!
  .setCharacteristic(Characteristic.Manufacturer, "IKEA of Sweden")
  .setCharacteristic(Characteristic.Model, "FYRTUR block-out roller blind");
// .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

blind.on(
  AccessoryEventTypes.IDENTIFY,
  (_paired: boolean, callback: VoidCallback) => callback()
);

const blindObj = new BlindAccessory(blind);

export default blindObj.getAccessory();
