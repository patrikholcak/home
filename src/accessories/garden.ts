import fs from "fs";
import path from "path";
import {
  Accessory,
  AccessoryEventTypes,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  NodeCallback,
  Service,
  uuid,
  VoidCallback,
} from "hap-nodejs";

const API = path.join(__dirname, "../../../API");

const readApi = () => JSON.parse(fs.readFileSync(API, "utf8"));

const writeApi = (content: Object) =>
  fs.writeFileSync(API, JSON.stringify(content));

const GARDEN = {
  identify: function() {
    console.log("Identify garden.");
  },
  setState: (value: CharacteristicValue) => {
    const currentState = readApi();
    return writeApi({ ...currentState, garden: value });
  },
};

const gardenUUID = uuid.generate("com-patrikolcak:accessories:Garden");
const garden = new Accessory("Garden", gardenUUID);

// @ts-ignore
garden.username = "94:28:E7:71:22:FF";
// @ts-ignore
garden.pincode = "031-45-154";

garden
  .getService(Service.AccessoryInformation)!
  .setCharacteristic(Characteristic.Manufacturer, "Plachta & IKEA")
  .setCharacteristic(Characteristic.Model, "Rev-1");
// .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

garden.on(
  AccessoryEventTypes.IDENTIFY,
  (paired: boolean, callback: VoidCallback) => {
    GARDEN.identify();
    callback();
  }
);

garden
  .addService(Service.Switch, "Garden")
  .getCharacteristic(Characteristic.On)!
  .on(
    CharacteristicEventTypes.SET,
    (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      GARDEN.setState(value);
      callback();
    }
  );

garden
  .getService(Service.Switch)!
  .getCharacteristic(Characteristic.On)!
  .on(
    CharacteristicEventTypes.GET,
    (callback: NodeCallback<CharacteristicValue>) => {
      try {
        const { garden } = readApi();

        return callback(null, garden);
      } catch (e) {
        callback(e, undefined);
      }
    }
  );

export default garden;
