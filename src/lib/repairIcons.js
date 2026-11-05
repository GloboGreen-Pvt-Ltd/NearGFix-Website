/**
 * repairIcons.js — an icon that matches what a repair category / service is
 * actually about, picked from its real master-data name (the API's iconUrl
 * is empty for these rows). Rules run top to bottom and the first match
 * wins, so specific wording ("Camera Not Working", "Touchpad") sits above
 * the broad words it contains ("camera", "touch"). A service whose name
 * matches nothing falls back to its category's icon, then to Wrench.
 */

import {
  Activity,
  Aperture,
  AudioLines,
  Battery,
  BatteryCharging,
  BatteryLow,
  Bluetooth,
  Bug,
  Cable,
  Camera,
  CameraOff,
  CardSim,
  CircleDot,
  CircleEllipsis,
  Cpu,
  DatabaseBackup,
  Droplets,
  Ear,
  Fan,
  Fingerprint,
  Footprints,
  Gauge,
  Hammer,
  HardDrive,
  Headphones,
  HeartPulse,
  Keyboard,
  Laptop,
  LockKeyhole,
  MapPin,
  MemoryStick,
  Mic,
  MonitorOff,
  MonitorSmartphone,
  Moon,
  Move,
  PhoneCall,
  Play,
  Plug,
  Pointer,
  Power,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  Speaker,
  Stethoscope,
  Thermometer,
  Touchpad,
  Tv,
  Usb,
  Volume1,
  Volume2,
  VolumeX,
  Watch,
  Webcam,
  Wifi,
  Wrench,
} from 'lucide-react';

const SERVICE_RULES = [
  // Water before board-level work: "Water Damage Repair" lives under Motherboard & IC.
  [/water|liquid/, Droplets],
  [/diagnos|intermittent/, Stethoscope],
  [/screen lock/, LockKeyhole],
  [/\bic\b|motherboard|circuit|processor|bios|uefi|cmos/, Cpu],

  [/webcam/, Webcam],
  [/camera.*(not working|issue)/, CameraOff],
  [/blur|camera glass|lens/, Aperture],
  [/camera/, Camera],

  [/calling/, PhoneCall],
  [/micro?phone|\bmic\b|echo|voice/, Mic],
  [/earpiece/, Ear],
  [/headphone|audio jack|\baux\b/, Headphones],

  [/wireless charging/, BatteryCharging],
  [/battery drain/, BatteryLow],
  [/battery/, Battery],
  [/charging cable|cable replacement/, Cable],
  [/power adapter|charger|adapter|dc jack/, Plug],
  [/charg/, BatteryCharging],

  [/no sound|sound cutting|speaker not working|mute/, VolumeX],
  [/low sound/, Volume1],
  [/distort|crackl/, AudioLines],
  [/speaker/, Speaker],
  [/volume button|sound|audio/, Volume2],

  [/power button|no power|not powering|power-on|random shutdown/, Power],
  [/restart|boot loop|stuck on logo/, RefreshCw],

  [/backup|data recovery|data transfer|cloning/, DatabaseBackup],
  [/\bram\b|memory/, MemoryStick],
  [/hdd|ssd|storage|sd card/, HardDrive],

  [/touchpad|trackpad/, Touchpad],
  [/keyboard|\bkey\b/, Keyboard],
  [/no display/, MonitorOff],
  [/touch/, Pointer],
  [/screen|display|lcd|led|backlight|flicker/, MonitorSmartphone],

  [/wi-?fi/, Wifi],
  [/bluetooth|pairing|\btws\b/, Bluetooth],
  [/gps/, MapPin],
  [/\bsim\b/, CardSim],
  [/network|signal|mobile data|connection/, Signal],
  [/usb/, Usb],
  [/hdmi|\blan\b|port|connector/, Cable],

  [/fingerprint|face ?id/, Fingerprint],
  [/heart rate/, HeartPulse],
  [/step counter/, Footprints],
  [/sleep/, Moon],
  [/motion/, Move],
  [/sensor|spo/, Activity],

  [/fan/, Fan],
  [/overheat|thermal|cooling/, Thermometer],
  [/hang|freez|slow|performance/, Gauge],

  [/antivirus/, ShieldCheck],
  [/virus|malware|security/, Bug],
  [/password|\bpin\b|lock|login|account/, LockKeyhole],
  [/factory reset|software reset|restore/, RotateCcw],
  [/sync|update|upgrade/, RefreshCw],
  [/software|firmware|\bos\b|windows|driver|formatting|\bapp\b|install/, Settings],

  [/hinge|bezel|laptop body/, Laptop],
  [/strap|crown/, Watch],
  [/remote/, Tv],
  [/play\/pause/, Play],
  [/button|control panel/, CircleDot],
  [/back (cover|glass|panel)|frame|glass|body|cabinet|grill|driver replacement|physical|damage/, Hammer],

  [/clean|maintenance/, Sparkles],
];

const CATEGORY_RULES = [
  [/keyboard|touchpad/, Keyboard],
  [/hinge/, Laptop],
  [/body|physical/, Hammer],
  [/data|backup/, DatabaseBackup],
  [/screen|display|touch/, MonitorSmartphone],
  [/batter|charg/, BatteryCharging],
  [/power/, Power],
  [/microphone|calling/, Mic],
  [/speaker|sound|audio/, Speaker],
  [/camera/, Camera],
  [/button|crown/, CircleDot],
  [/bluetooth/, Bluetooth],
  [/port|connector/, Usb],
  [/network|connectivity/, Signal],
  [/sensor/, Activity],
  [/motherboard|circuit|\bic\b|hardware/, Cpu],
  [/overheat|cooling/, Thermometer],
  [/virus/, Bug],
  [/security|account/, LockKeyhole],
  [/software|firmware|\bos\b|operating system/, Settings],
  [/storage|memory/, HardDrive],
  [/performance/, Gauge],
  [/upgrade|maintenance/, Sparkles],
  [/accessor/, Cable],
  [/water|liquid/, Droplets],
  [/diagnos/, Stethoscope],
  [/other|misc/, CircleEllipsis],
];

function match(rules, text) {
  const s = String(text || '').toLowerCase();
  const hit = rules.find(([re]) => re.test(s));
  return hit ? hit[1] : null;
}

/** Icon for a repair category, from its name/displayName. */
export function iconForRepairCategory(name) {
  return match(CATEGORY_RULES, name) || Wrench;
}

/** Icon for one repair service, from its own name; falls back to its category's icon. */
export function iconForRepairService(serviceName, categoryName) {
  return match(SERVICE_RULES, serviceName) || iconForRepairCategory(categoryName);
}
