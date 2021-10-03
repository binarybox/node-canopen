#!/usr/bin/env node

/**
 * SDO client example.
 *
 * This example shows how to create a CANopen device that downloads (writes)
 * and uploads (reads) data from an SDO server.
 */

/* eslint no-console: "off" */

const clientId = 0xa;
const serverId = 0xb;

const { Device, DataType } = require('../index.js');
const can = require('socketcan');

// Step 1: Create a new Device.
const device = new Device({ id: clientId });

// Step 2: Create a new socketcan RawChannel object.
const channel = can.createRawChannel('can0');

// Step 3: Configure the SDO client parameters.
device.sdo.addServer(serverId);

// Step 4: Initialize and start the device.
channel.addListener('onMessage', (message) => device.receive(message));
device.setTransmitFunction((message) => channel.send(message));

device.init();
channel.start();

// Step 5: Write data to the server then read it back.
const date = new Date();

device.sdo.download({
    serverId: serverId,
    data: date.toString(),
    dataType: DataType.VISIBLE_STRING,
    index: 0x2000
})
.then(() => {
    device.sdo.upload({
        serverId: serverId,
        index: 0x2000,
        dataType: DataType.VISIBLE_STRING
    })
    .then((value) => {
        console.log(value);
        channel.stop();
    });
});
