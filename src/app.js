'use strict'

let isEmbed;
try {
	isEmbed = window.self !== window.top;
} catch (e) {
	isEmbed = true;
}

if (!isEmbed) {
	document.body.className = "";
}

const emulator = new Emu()

emulator.init().then(() => {
	emulator.bgCanvas = document.getElementById("bgcanvas");
	emulator.fgCanvas = document.getElementById("fgcanvas");
	emulator.screen.bgctx = emulator.bgCanvas.getContext("2d", {"willReadFrequently": true})
	emulator.screen.fgctx = emulator.fgCanvas.getContext("2d", {"willReadFrequently": true})
	emulator.fgCanvas.addEventListener("pointermove", emulator.pointer_moved);
	emulator.fgCanvas.addEventListener("pointerdown", emulator.pointer_down);
	emulator.fgCanvas.addEventListener("pointerup", emulator.pointer_up);
	
	// window -> window.parent to allow iframe to catch keyboard inputs
	window.parent.addEventListener("keydown", emulator.controller.keyevent);
	window.parent.addEventListener("keyup", emulator.controller.keyevent);

	// Animation callback
	function step() {
		emulator.screen_callback();
		window.requestAnimationFrame(step)
	}

	emulator.screen.set_size(512, 320)
	window.requestAnimationFrame(step);

	fetch("pinkie.rom")
		.then((res) => res.arrayBuffer())
		.then((buffer) => {
			const rom = new Uint8Array(buffer)
			emulator.screen.set_size(512, 320)
			loadROM(rom);
		})


	document.getElementById("content").style.display = "block";
	document.getElementById("loading").style.display = "none";
});

function loadROM(rom) {
	emulator.uxn.load(rom).eval(0x0100);
}
