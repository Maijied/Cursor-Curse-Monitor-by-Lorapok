---
name: nvidia-dp-cec
description: NVIDIA DisplayPort / CEC TV handshake and VBIOS firmware after a sleep crash. Use after Windows boots, or when HDMI works and DisplayPort does not.
---

# NVIDIA DisplayPort / CEC

Original trigger: Haier Matrix EE Android TV + DP adapter + CEC sleep hung the GPU and Windows display topology.

## After Windows is reachable

1. Confirm picture on **GPU HDMI** first.
2. Do not plug the TV on DP until HDMI is stable.
3. If HDMI OK and DP fails POST or black screen: NVIDIA DisplayPort firmware updater (10/20-series class issue; still try on newer cards).
4. Disable CEC/HDMI-CEC on the TV; use the TV as a monitor only, or a real PC monitor.
5. In NVIDIA Control Panel / Windows: do not set the sleeping TV as the only active display.

OS hive work for this machine is already done (`HiberbootEnabled=0`, display Configuration/Connectivity purged). Do not redo unless a new topology lock appears after a successful boot.
