// Import the modules
const Patches = require('Patches');
const R = require('Reactive');

// Monitor 'roundedNumber' from the patches
Patches.outputs.getScalar('roundedNumberY').then(roundedNumber => {
    roundedNumber.monitor().subscribe((event) => {
        // Convert to float, keep two decimal places, and convert to string
        // Convert to float and round to 2 decimal places
        // To modify the rounding to 3 decimal places, you would multiply and divide by 1000 instead of 100, as follows:
        // let roundedNumber = R.round(inputNumber.mul(1000)).div(1000); <-- from other code "rounded string"
        // let resultString = parseFloat(event.newValue.toFixed(3)); < -- this would also need adjustment
        let resultString = parseFloat(event.newValue.toFixed(3));

        // Send 'finalResult' back to the patches
        Patches.inputs.setString('finalResultY', resultString.toString());
    });
});
