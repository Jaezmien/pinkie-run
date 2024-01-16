'use strict'

const blending = [
	[0, 0, 0, 0, 1, 0, 1, 1, 2, 2, 0, 2, 3, 3, 3, 0],
	[0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
	[1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1],
	[2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2]];

function Screen(emu)
{
	this.width = 512
	this.height = 320
	this.colors = [{r: 0, g: 0, b:0}];

	this.blank_screen = () => {
		const c = this.colors[0]
		this.bgctx.fillStyle = "rgba("+c.r.toString(10)+","+c.g.toString(10)+","+c.b.toString(10)+")"
		this.bgctx.fillRect(0, 0, this.width, this.height)
	}

	this.draw_pixel = (ctrl,x,y,move) => {
		const ctx = ctrl & 0x40 ? this.fgctx : this.bgctx
		const color = ctrl & 0x3
		const c = this.colors[color]
		const a = (color == 0 && (ctrl & 0x40)) ? 0 : 1
		if (a) {
			ctx.fillStyle = "rgba("+c.r.toString(10)+","+c.g.toString(10)+","+c.b.toString(10)+")"
		}
		// fill mode
		if(ctrl & 0x80) {
			let x2 = this.width
			let y2 = this.height
			if(ctrl & 0x10) x2 = x, x = 0
			if(ctrl & 0x20) y2 = y, y = 0
			a ? ctx.fillRect(x, y, x2 - x, y2 - y) : ctx.clearRect(x, y, x2 - x, y2 - y)
		}
		// pixel mode
		else {
			a? ctx.fillRect(x, y, 1, 1) : ctx.clearRect(x, y, 1, 1)
		}
		if (move & 0x1) 
			poke16(emu.uxn.dev, 0x28, x + 1);
		if (move & 0x2) 
			poke16(emu.uxn.dev, 0x2a, y + 1);
	}

	this.draw_sprite = (ctrl, x, y, move, ptr) => {
		const twobpp = !!(ctrl & 0x80);
		const length = move >> 4;
		const ctx = ctrl & 0x40 ? this.fgctx : this.bgctx;
		const color = ctrl & 0xf, opaque = color % 5;
		const width = ctx.canvas.width;
		const height = ctx.canvas.height;
		const flipx = (ctrl & 0x10), fx = flipx ? -1 : 1;
		const flipy = (ctrl & 0x20), fy = flipy ? -1 : 1;
		const dx = (move & 0x1) << 3, dxy = dx * fy;
		const dy = (move & 0x2) << 2, dyx = dy * fx;
		const addr_incr = (move & 0x4) << (1 + twobpp);
		for (let i = 0; i <= length; i++) {
			let x1 = x + dyx * i
			let y1 = y + dxy * i
			var imDat = ctx.getImageData(x1,y1, 8, 8);
			for (let v = 0; v < 8; v++) {
				let c = emu.uxn.ram[(ptr + v) & 0xffff] | (twobpp? (emu.uxn.ram[(ptr + v + 8) & 0xffff] << 8): 0);
				let v1 = (flipy ? 7 - v : v)
				for (let h = 7; h >= 0; --h, c >>= 1) {
					let ch = (c & 1) | ((c >> 7) & 2)
					if (opaque || ch) {
						let imdati = ((flipx ? 7 - h : h) + v1 * 8) * 4;
						let b = blending[ch][color]
						let c = this.colors[b]
						imDat.data[imdati] = c.r
						imDat.data[imdati+1] = c.g
						imDat.data[imdati+2] = c.b
						imDat.data[imdati+3] = (!b && (ctrl & 0x40)) ? 0 : 255 // alpha
					}
				}
			}	
			ctx.putImageData(imDat, x1, y1);
			ptr += addr_incr;
		}
		if(move & 0x1) {
			x = x + dx * fx;
			poke16(emu.uxn.dev, 0x28, x);
		}
		if(move & 0x2) {
			y = y + dy * fy;
			poke16(emu.uxn.dev, 0x2a, y);
		}
		if(move & 0x4) {
			poke16(emu.uxn.dev, 0x2c, ptr);
		}
	}

	this.set_width = (w) => {
		this.fgctx.canvas.width = w;
		this.bgctx.canvas.width = w;
		this.width = w;
		this.blank_screen()
	}

	this.set_height = (h) => {
		this.bgctx.canvas.height = h;
		this.fgctx.canvas.height = h;
		this.height = h;
		this.blank_screen()
	}

	this.set_size = (w, h) => {
		this.fgctx.canvas.width = w;
		this.bgctx.canvas.width = w;
		this.bgctx.canvas.height = h;
		this.fgctx.canvas.height = h;
		this.width = w;
		this.height = h;
		this.blank_screen()
	}

	this.dei = (port) => {
		switch (port) {
			case 0x22: return this.width >> 8;
			case 0x23: return this.width & 0xf0;
			case 0x24: return this.height >> 8;
			case 0x25: return this.height & 0xf0;
			default: return emulator.uxn.dev[port];
		}
	}

	this.update_palette = () => {
		let r1 = emu.uxn.dev[0x8]
		let r2 = emu.uxn.dev[0x9]
		let g1 = emu.uxn.dev[0xa]
		let g2 = emu.uxn.dev[0xb]
		let b1 = emu.uxn.dev[0xc]
		let b2 = emu.uxn.dev[0xd]
		this.colors[0] = {r: (r1 >> 4) << 4, g: (g1 >> 4) << 4, b: (b1 >> 4) << 4}
		this.colors[1] = {r: (r1 & 0xf) << 4, g: (g1 & 0xf) << 4, b: (b1 & 0xf) << 4}
		this.colors[2] = {r: (r2 >> 4) << 4, g: (g2 >> 4) << 4, b: (b2 >> 4) << 4}
		this.colors[3] = {r: (r2 & 0xf) << 4, g: (g2 & 0xf) << 4, b: (b2 & 0xf) << 4}
		this.blank_screen()
	}
}
