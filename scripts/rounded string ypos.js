// Import the modules
const Patches = require('Patches');
const R = require('Reactive');

// Get 'number' from the patches
Patches.outputs.getScalar('numberY').then(inputNumber => {
    // Convert to float and round to 2 decimal places
    // To modify the rounding to 3 decimal places, you would multiply and divide by 1000 instead of 100, as follows:
    // let roundedNumber = R.round(inputNumber.mul(1000)).div(1000);
    let roundedNumber = R.round(inputNumber.mul(1000)).div(1000);

    // Prepare the rounded number to be sent back to the patches
    Patches.inputs.setScalar('resultY', roundedNumber);
});
