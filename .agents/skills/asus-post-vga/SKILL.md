---
name: asus-post-vga
description: Isolates ASUS Q-LED POST failures, especially solid white VGA LED on TUF GAMING B460M-PLUS with i5-10400 iGPU plus NVIDIA RTX. Use when the PC has no display, no USB power at POST, GPU fans spin, or VGA LED stays on.
---

# ASUS POST / white VGA LED

Q-LED order: CPU (red) → DRAM (yellow) → VGA (white) → BOOT (yellow-green). A LED that **stays on** is the failed stage.

## Isolation (power cord unplugged)

1. Pull the RTX card entirely. Monitor → **motherboard HDMI** (not GPU).
2. If it POSTs: board + CPU + RAM + PSU logic are OK. Fault is GPU, slot, or GPU power.
3. If it still VGA-hangs with GPU removed: CMOS (CLRCMOS jumper or CR2032 60s), one RAM stick in **A2**, try DVI-D, confirm 24-pin + CPU 8-pin.
4. Reseat GPU: clean gold fingers, full latch click, **all** PCIe 6/8-pin cables seated (fans spinning ≠ GPU powered).
5. Prefer HDMI on GPU before DisplayPort. NVIDIA cold-boot DP handshake often looks like a VGA hang.

Official ASUS no-display FAQ: https://www.asus.com/us/support/faq/1042632/
Manual: TUF GAMING B460M-PLUS — iGPU HDMI 1.4b, DP 1.4, DVI-D; PEG is PCIe 3.0 x16_1.
