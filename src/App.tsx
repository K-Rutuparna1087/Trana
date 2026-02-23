/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  AlertCircle, 
  Map as MapIcon, 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  Navigation, 
  Activity,
  Heart,
  Phone,
  Menu,
  X,
  ChevronRight,
  Zap,
  Lock,
  Eye,
  CheckCircle2,
  Clock,
  TrendingUp,
  Info,
  Bus,
  Hospital,
  History,
  Radio,
  Globe,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from './utils';


const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : '');

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Types
type Role = 'civilian' | 'doctor' | 'police' | 'volunteer' | 'command' | 'admin';

interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
}

interface Incident {
  id: number;
  type: string;
  status: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lat: number;
  lng: number;
  created_at: string;
}

// Components
const Navbar = ({
  user,
  onLogout,
  onToggleSidebar,
  language,
  setLanguage
}: {
  user: User | null,
  onLogout: () => void,
  onToggleSidebar: () => void,
  language: string,
  setLanguage: (lang: string) => void
}) => {

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ta', label: 'Tamil' },
    { code: 'hi', label: 'Hindi' },
    { code: 'mr', label: 'Marathi' },
    { code: 'kn', label: 'Kannada' },
    { code: 'te', label: 'Telugu' },
    { code: 'ml', label: 'Malayalam' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-xl border-b border-zinc-200 z-[100] flex items-center justify-between px-6 shadow-sm">

      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="p-2 hover:bg-zinc-100 rounded-lg lg:hidden">
          <Menu className="w-6 h-6 text-zinc-900" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-zinc-900">TRANA</span>
        </div>
      </div>

      <div className="flex items-center gap-4">

        {/* LANGUAGE DROPDOWN */}
        <div className="relative group hidden md:block">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600">
            <Globe className="w-3.5 h-3.5" />
            {languages.find(l => l.code === language)?.label}
          </button>

          <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-2xl border border-zinc-200 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2">
            {languages.map(l => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 rounded-lg"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {user && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full border">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs capitalize">{user.role}</span>
          </div>
        )}

        <button className="p-2 hover:bg-zinc-100 rounded-full relative">
          <Bell className="w-5 h-5 text-zinc-500" />
        </button>

        {user ? (
          <button onClick={onLogout} className="text-sm text-zinc-500 hover:text-zinc-900">
            Sign Out
          </button>
        ) : (
          <button className="text-sm text-white bg-emerald-500 px-4 py-2 rounded-lg">
            Login
          </button>
        )}

      </div>
    </nav>
  );
};

const Sidebar = ({ isOpen, activeTab, setActiveTab, role }: { isOpen: boolean, activeTab: string, setActiveTab: (t: string) => void, role: Role }) => {
  const menuItems = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard', roles: ['civilian', 'doctor', 'police', 'volunteer', 'command', 'admin'] },
    { id: 'map', icon: MapIcon, label: 'Crisis Map', roles: ['civilian', 'doctor', 'police', 'volunteer', 'command', 'admin'] },
    { id: 'safewalk', icon: Eye, label: 'SafeWalk', roles: ['civilian'] },
    { id: 'incidents', icon: AlertCircle, label: 'Incidents', roles: ['doctor', 'police', 'volunteer', 'command', 'admin'] },
    { id: 'responders', icon: Users, label: 'Responders', roles: ['command', 'admin'] },
    { id: 'analytics', icon: TrendingUp, label: 'Intelligence', roles: ['command', 'admin'] },
    { id: 'settings', icon: SettingsIcon, label: 'Settings', roles: ['civilian', 'doctor', 'police', 'volunteer', 'command', 'admin'] },
  ];

  return (
    <aside className={cn(
      "fixed left-0 top-20 bottom-0 w-64 bg-white border-r border-zinc-200 z-40 transition-transform duration-300 lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4 space-y-2">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group",
              activeTab === item.id 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "group-hover:text-zinc-900")} />
            <span className="font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">System Status</span>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            All nodes operational. City safety score: <span className="text-emerald-600 font-bold">84/100</span>
          </p>
        </div>
      </div>
    </aside>
  );
};

const SOSButton = ({ onTrigger }: { onTrigger: (type: string) => void }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSelector, setShowSelector] = useState(false);
  const timerRef = useRef<any>(null);

  const startHold = () => {
    setIsHolding(true);
    let p = 0;
    timerRef.current = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p >= 100) {
        clearInterval(timerRef.current);
        setShowSelector(true);
        setIsHolding(false);
        setProgress(0);
      }
    }, 20);
  };

  const stopHold = () => {
    setIsHolding(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const emergencyTypes = [
    { id: 'Medical', icon: Heart, color: 'bg-red-500', label: 'Medical' },
    { id: 'Police', icon: Shield, color: 'bg-indigo-600', label: 'Police' },
    { id: 'Fire', icon: Zap, color: 'bg-orange-500', label: 'Fire' },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute -inset-8 bg-emerald-500/10 rounded-full animate-ping" />
        <div className="absolute -inset-4 bg-emerald-500/20 rounded-full animate-pulse" />
        
        <button
          onMouseDown={startHold}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={startHold}
          onTouchEnd={stopHold}
          className={cn(
            "relative w-48 h-48 rounded-full bg-emerald-500 flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/40 transition-transform active:scale-95 select-none",
            isHolding && "scale-105"
          )}
        >
          <Zap className="w-12 h-12 text-white mb-2 fill-white" />
          <span className="text-3xl font-black tracking-tighter text-white">SOS</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-2">Hold to Trigger</span>
          
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="90"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeDasharray="565.48"
              strokeDashoffset={565.48 - (565.48 * progress) / 100}
              className="transition-all duration-75 ease-linear"
            />
          </svg>
        </button>
      </div>
      
      <div className="text-center">
        <h3 className="text-xl font-bold text-zinc-900 mb-1">Emergency Assistance</h3>
        <p className="text-sm text-zinc-500">Police (100), Medical, and Fire services will be notified.</p>
      </div>

      <AnimatePresence>
        {showSelector && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tight text-zinc-900 mb-2 text-center">Select Emergency Type</h3>
              <p className="text-sm text-zinc-500 text-center mb-8">This helps us dispatch the right responders immediately.</p>
              
              <div className="grid grid-cols-1 gap-3">
                {emergencyTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      onTrigger(type.id);
                      setShowSelector(false);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg", type.color)}>
                      <type.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-bold text-zinc-900">{type.label}</h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Immediate Dispatch</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => setShowSelector(false)}
                className="w-full mt-6 py-3 text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Static Icons to prevent re-creation errors
const HOSPITAL_ICON = L.divIcon({
  html: `<div class="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
});

const BUS_ICON = L.divIcon({
  html: `<div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h20"/><path d="M2 18h20"/><path d="M5 22h14"/></svg></div>`,
  className: '',
  iconSize: [24, 24],
});

const RESPONDER_ICONS: Record<string, L.DivIcon> = {
  police: L.divIcon({
    html: `<div class="w-8 h-8 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white animate-pulse"><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
    className: '',
    iconSize: [32, 32],
  }),
  doctor: L.divIcon({
    html: `<div class="w-8 h-8 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white animate-pulse"><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
    className: '',
    iconSize: [32, 32],
  }),
  volunteer: L.divIcon({
    html: `<div class="w-8 h-8 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white animate-pulse"><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
    className: '',
    iconSize: [32, 32],
  }),
};

const CrisisMap = ({ incidents, responderLocations }: { incidents: Incident[], responderLocations: Record<number, { lat: number, lng: number }> }) => {
  const [location, setLocation] = useState<[number, number]>([51.505, -0.09]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showDensity, setShowDensity] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showBusStops, setShowBusStops] = useState(true);
  const [densityPoints, setDensityPoints] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any[]>([]);
  const [localResponders, setLocalResponders] = useState<any[]>([]);

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setLocation(newLoc);
      
      // Generate random density points around current location
      const points = Array.from({ length: 30 }).map(() => ({
        lat: newLoc[0] + (Math.random() - 0.5) * 0.08,
        lng: newLoc[1] + (Math.random() - 0.5) * 0.08,
        intensity: Math.random()
      }));
      setDensityPoints(points);

      // Generate Hospitals
      const h = Array.from({ length: 3 }).map((_, i) => ({
        id: i,
        name: `City Hospital ${i + 1}`,
        lat: newLoc[0] + (Math.random() - 0.5) * 0.03,
        lng: newLoc[1] + (Math.random() - 0.5) * 0.03,
      }));
      setHospitals(h);

      // Generate Bus Stops
      const b = Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        name: `Bus Stop #${100 + i}`,
        lat: newLoc[0] + (Math.random() - 0.5) * 0.04,
        lng: newLoc[1] + (Math.random() - 0.5) * 0.04,
      }));
      setBusStops(b);

      // Generate more local responders (within 1km approx 0.01 deg)
      const r = Array.from({ length: 12 }).map((_, i) => ({
        id: i + 1000,
        role: i % 3 === 0 ? 'doctor' : i % 3 === 1 ? 'police' : 'volunteer',
        lat: newLoc[0] + (Math.random() - 0.5) * 0.015,
        lng: newLoc[1] + (Math.random() - 0.5) * 0.015,
      }));
      setLocalResponders(r);

      if (mapRef.current) {
        mapRef.current.setView(newLoc, 14);
      }
    }, (err) => {
      console.error("Geolocation error:", err);
    }, { enableHighAccuracy: true });
  }, []);

  return (
    <div className="h-full w-full rounded-[2.5rem] overflow-hidden border border-zinc-200 relative shadow-2xl shadow-black/5">
      <MapContainer 
        center={location} 
        zoom={14} 
        className="h-full w-full"
        ref={(map) => { if (map) mapRef.current = map; }}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
        />
        <Marker position={location}>
          <Popup>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold">You are here (Live)</span>
            </div>
          </Popup>
        </Marker>

        {showHospitals && hospitals.map(h => (
          <Marker key={`hosp-${h.id}`} position={[h.lat, h.lng]} icon={HOSPITAL_ICON}>
            <Popup><span className="font-bold">{h.name}</span></Popup>
          </Marker>
        ))}

        {showBusStops && busStops.map(b => (
          <Marker key={`bus-${b.id}`} position={[b.lat, b.lng]} icon={BUS_ICON}>
            <Popup><span className="font-bold">{b.name}</span></Popup>
          </Marker>
        ))}

        {localResponders.map((r) => (
          <Marker key={`local-res-${r.id}`} position={[r.lat, r.lng]} icon={RESPONDER_ICONS[r.role] || RESPONDER_ICONS.volunteer}>
            <Popup>
              <div className="p-1">
                <p className="font-bold capitalize text-zinc-900">{r.role} Responder</p>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Within 1km Radius</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {showDensity && densityPoints.map((p, i) => (
          <Circle 
            key={`density-${i}`}
            center={[p.lat, p.lng]}
            radius={400 * p.intensity}
            pathOptions={{ 
              color: 'transparent', 
              fillColor: '#10b981', 
              fillOpacity: 0.15 * p.intensity 
            }}
          />
        ))}

        {Object.entries(responderLocations).map(([id, pos]) => {
          if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;
          return (
            <Marker key={`responder-${id}`} position={[pos.lat, pos.lng]}>
              <Popup>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold">Active Responder #{id}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {showHeatmap ? (
          incidents.map(inc => (
            <Circle 
              key={`heat-${inc.id}`}
              center={[inc.lat, inc.lng]}
              radius={400}
              pathOptions={{ 
                color: 'transparent', 
                fillColor: '#ef4444', 
                fillOpacity: 0.2 
              }}
            />
          ))
        ) : (
          incidents.map(inc => (
            <Circle 
              key={inc.id}
              center={[inc.lat, inc.lng]}
              radius={200}
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-bold uppercase text-emerald-600">{inc.type} Incident</h4>
                  <p className="text-xs text-zinc-500">Status: {inc.status}</p>
                  <p className="text-xs text-zinc-500">Severity: {inc.severity}</p>
                </div>
              </Popup>
            </Circle>
          ))
        )}
      </MapContainer>
      
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-zinc-200 shadow-2xl shadow-black/5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Map Layers</h4>
          <div className="space-y-2">
            {[
              { id: 'incidents', label: 'Incidents', active: !showHeatmap, onClick: () => setShowHeatmap(false) },
              { id: 'heatmap', label: 'Incident Heatmap', active: showHeatmap, onClick: () => setShowHeatmap(true) },
              { id: 'density', label: 'Human Density', active: showDensity, onClick: () => setShowDensity(!showDensity) },
              { id: 'hospitals', label: 'Hospitals', active: showHospitals, onClick: () => setShowHospitals(!showHospitals) },
              { id: 'busstops', label: 'Bus Stops', active: showBusStops, onClick: () => setShowBusStops(!showBusStops) },
              { id: 'responders', label: 'Responders', active: true },
            ].map(layer => (
              <button 
                key={layer.id} 
                onClick={layer.onClick}
                className="flex items-center gap-2 cursor-pointer group w-full text-left"
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border transition-all",
                  layer.active ? "bg-emerald-500 border-emerald-500 scale-110" : "border-zinc-300 group-hover:border-emerald-500"
                )} />
                <span className={cn(
                  "text-xs transition-colors",
                  layer.active ? "text-zinc-900 font-bold" : "text-zinc-500 group-hover:text-zinc-900"
                )}>{layer.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user, stats, onViewAll }: { user: User, stats: any, onViewAll: () => void }) => {
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    fetch('/api/intelligence/risk')
      .then(res => res.json())
      .then(data => setIntelligence(data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Incidents', value: stats.totalIncidents, icon: AlertCircle, color: 'text-emerald-600' },
          { label: 'Responders Online', value: stats.activeResponders, icon: Users, color: 'text-emerald-500' },
          { label: 'Resolved Today', value: stats.resolvedToday, icon: CheckCircle2, color: 'text-blue-500' },
          { label: 'Safety Score', value: `${stats.safetyScore}/100`, icon: Shield, color: 'text-amber-500' },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white p-6 rounded-[2rem] border border-zinc-200 hover:shadow-xl hover:shadow-black/5 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-xl bg-zinc-50", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-zinc-300" />
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 mb-1">{stat.value}</h3>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-zinc-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-zinc-900">Recent Activity</h3>
            <button 
              onClick={onViewAll}
              className="text-xs font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-500"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-zinc-900">Emergency Protocol Initiated</h4>
                  <p className="text-xs text-zinc-500">Sector 4, Downtown • {i + 2} mins ago</p>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-zinc-200 p-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Risk Intelligence
            </h3>
            {intelligence ? (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Peak Risk Hours</p>
                  <p className="text-sm text-zinc-900 font-bold">{intelligence.peakRiskHours}</p>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Anomaly Likelihood</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${intelligence.anomalyLikelihood}%` }} 
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-900">{intelligence.anomalyLikelihood}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-zinc-50 rounded-2xl" />
                <div className="h-16 bg-zinc-50 rounded-2xl" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] border border-zinc-200 p-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-6">Critical Contacts</h3>
            <div className="space-y-3">
              {[
                { name: 'Police Dispatch', phone: '100', icon: Shield },
                { name: 'Medical Emergency', phone: '102', icon: Heart },
                { name: 'Fire Department', phone: '101', icon: Zap },
                { name: 'Women Helpline', phone: '1091', icon: Info },
              ].map((contact) => (
                <a 
                  key={contact.name} 
                  href={`tel:${contact.phone}`}
                  className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-colors group no-underline"
                >
                  <div className="flex items-center gap-3">
                    <contact.icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-900">{contact.name}</p>
                      <p className="text-xs text-zinc-500">{contact.phone}</p>
                    </div>
                  </div>
                  <Phone className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SafeWalk = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [destination, setDestination] = useState('');
  const [eta, setEta] = useState(15);
  const guardians = [
    { id: 1, name: 'Officer Mike Ross', role: 'Police', status: 'Active' },
    { id: 2, name: 'Dr. Sarah Chen', role: 'Medical', status: 'Active' },
    { id: 3, name: 'Volunteer Jane', role: 'Volunteer', status: 'Standby' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-8 lg:p-12 text-center shadow-2xl shadow-black/5">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Eye className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Guardian Watch</h2>
        <p className="text-zinc-500 mb-8">Share your live location with trusted contacts and TRANA responders during your commute.</p>
        
        {!isStarted ? (
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Destination</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Where are you heading?"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-4 text-zinc-900 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            <button 
              onClick={() => setIsStarted(true)}
              disabled={!destination}
              className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Start SafeWalk Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-emerald-700">Live Monitoring Active</span>
                </div>
                <span className="text-xs font-bold text-emerald-600">{eta} mins remaining</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Destination</p>
                <p className="text-lg font-bold text-emerald-900">{destination}</p>
              </div>
              <button 
                onClick={() => setIsStarted(false)}
                className="mt-6 w-full py-3 bg-white border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-widest"
              >
                End Session
              </button>
            </div>
            
            <div className="text-left">
              <h3 className="text-sm font-bold text-zinc-900 mb-4 uppercase tracking-widest">Active Guardians</h3>
              <div className="space-y-3">
                {guardians.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-400">
                        {g.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{g.name}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{g.role}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white rounded-full border border-zinc-200">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">{g.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Deviation Detection', icon: Navigation },
          { label: 'Timed Check-ins', icon: Clock },
          { label: 'Panic Trigger', icon: Zap },
        ].map(feature => (
          <div key={feature.label} className="p-4 bg-white rounded-2xl border border-zinc-200 flex flex-col items-center gap-2 shadow-sm">
            <feature.icon className="w-5 h-5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-600">{feature.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Settings = ({ user, onSave }: { user: User, onSave: () => void }) => (
  <div className="max-w-4xl mx-auto space-y-8">
    <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-8 shadow-sm">
      <h3 className="text-xl font-bold text-zinc-900 mb-6">Profile Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
          <input type="text" defaultValue={user.name} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
          <input type="email" defaultValue={user.email} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Role</label>
          <input type="text" value={user.role} disabled className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-400 outline-none capitalize" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Emergency Contact</label>
          <input type="tel" placeholder="+91 98765 43210" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Blood Group</label>
          <select className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors">
            <option>A+</option>
            <option>A-</option>
            <option>B+</option>
            <option>B-</option>
            <option>O+</option>
            <option>O-</option>
            <option>AB+</option>
            <option>AB-</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Home Address</label>
          <textarea placeholder="Enter your residential address for faster dispatch" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors h-24 resize-none" />
        </div>
      </div>
      <button 
        onClick={onSave}
        className="mt-8 px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
      >
        Save Changes
      </button>
    </div>

    <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-8 shadow-sm">
      <h3 className="text-xl font-bold text-zinc-900 mb-6">Security & Privacy</h3>
      <div className="space-y-4">
        {[
          { label: 'Two-Factor Authentication', desc: 'Add an extra layer of security to your account.', enabled: true },
          { label: 'Live Location Sharing', desc: 'Allow responders to see your location during emergencies.', enabled: true },
          { label: 'Anonymous Data Contribution', desc: 'Help improve city safety scores with anonymized data.', enabled: false },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <div>
              <p className="text-sm font-bold text-zinc-900">{item.label}</p>
              <p className="text-xs text-zinc-500">{item.desc}</p>
            </div>
            <div className={cn("w-12 h-6 rounded-full p-1 transition-colors cursor-pointer", item.enabled ? "bg-emerald-500" : "bg-zinc-300")}>
              <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", item.enabled ? "translate-x-6" : "translate-x-0")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AuthPage = ({ onAuth }: { onAuth: (u: User, token: string) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('civilian');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin
  ? `${API}/api/auth/login`
  : `${API}/api/auth/register`;
    const body = isLogin ? { email, password } : { name, email, password, role };
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (data.token) {
      onAuth(data.user, data.token);
    } else {
      alert(data.error);
    }
  };

  const handleOAuth = async () => {
    try {
      const endpoint = isLogin
  ? `${API}/api/auth/login`
  : `${API}/api/auth/register`;
      const { url } = await res.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (e) {
      alert('Failed to initiate OAuth');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onAuth(event.data.user, event.data.token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuth]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
            <Shield className="w-10 h-10 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 mb-2">TRANA OS</h1>
          <p className="text-zinc-500">Intelligent City-Scale Emergency Response</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-2xl shadow-black/5">
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", isLogin ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-900")}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", !isLogin ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-900")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                <select 
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 outline-none focus:border-emerald-500 transition-colors appearance-none"
                >
                  <option value="civilian">Civilian</option>
                  <option value="doctor">Medical Doctor</option>
                  <option value="police">Police Officer</option>
                  <option value="volunteer">Verified Volunteer</option>
                </select>
              </div>
            )}
            <button className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 mt-4 active:scale-[0.98]">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-400 font-bold tracking-widest">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleOAuth}
            className="w-full py-3 bg-white border border-zinc-200 text-zinc-900 font-bold rounded-xl hover:bg-zinc-50 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4 text-emerald-500" />
            OAuth Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState({ totalIncidents: 0, activeResponders: 0, resolvedToday: 0, safetyScore: 84 });
  const [responderLocations, setResponderLocations] = useState<Record<number, { lat: number, lng: number }>>({});
  const [activeIncidentPopup, setActiveIncidentPopup] = useState<Incident | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('trana_user');
    const savedToken = localStorage.getItem('trana_token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchIncidents();
      fetchStats();
      setupWebSocket();
    }
  }, [token]);

  const [isDispatching, setIsDispatching] = useState(false);

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
      
      // Send location updates
      navigator.geolocation.watchPosition((pos) => {
        ws.send(JSON.stringify({
          type: 'location_update',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
      });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_incident') {
        setIncidents(prev => {
          if (prev.find(i => i.id === data.incident.id)) return prev;
          return [data.incident, ...prev];
        });
        
        // Show popup for responders
        if (['doctor', 'police', 'volunteer'].includes(user?.role || '')) {
          setActiveIncidentPopup(data.incident);
        }

        if (Notification.permission === 'granted') {
          new Notification('Emergency Alert', { body: `New ${data.incident.type} incident reported nearby.` });
        }
      }
      if (data.type === 'incident_accepted') {
        alert('A responder has accepted your SOS and is on the way!');
        setIsDispatching(false);
        fetchIncidents();
      }
      if (data.type === 'incident_updated') {
        setIncidents(prev => prev.map(i => i.id === data.incident.id ? data.incident : i));
      }
      if (data.type === 'stats_update') {
        setStats(data.stats);
      }
      if (data.type === 'user_location_update') {
        setResponderLocations(prev => ({
          ...prev,
          [data.userId]: { lat: data.lat, lng: data.lng }
        }));
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  };

  const fetchIncidents = async () => {
    const res = await fetch('/api/incidents/active');
    const data = await res.json();
    setIncidents(data);
  };

  const fetchStats = async () => {
    const res = await fetch('/api/stats/summary');
    const data = await res.json();
    setStats(data);
  };

  const handleAuth = (u: User, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem('trana_user', JSON.stringify(u));
    localStorage.setItem('trana_token', t);
    
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('trana_user');
    localStorage.removeItem('trana_token');
    if (wsRef.current) wsRef.current.close();
  };

  const triggerSOS = async (type: string = 'SOS') => {
    setIsDispatching(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          reporterId: user?.id,
          severity: 'critical',
          language: language
        })
      });
      if (res.ok) {
        // We wait for the websocket 'incident_accepted' for final confirmation
        // but we show a local confirmation that it's sent
        fetchIncidents();
      } else {
        setIsDispatching(false);
        alert('Failed to trigger SOS. Please try again or call emergency services directly.');
      }
    }, () => {
      setIsDispatching(false);
      alert('Location access is required for SOS. Please enable GPS.');
    });
  };

  const acceptIncident = async (id: number) => {
    if (!['doctor', 'police', 'volunteer'].includes(user?.role || '')) {
      addToast('Only responders can accept dispatches.', 'error');
      return;
    }
    const res = await fetch(`/api/incidents/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responderId: user?.id })
    });
    if (res.ok) {
      addToast('Incident accepted. Proceed to location.', 'success');
      fetchIncidents();
    }
  };

  const resolveIncident = async (id: number) => {
    const incident = incidents.find(i => i.id === id);
    const isResponder = incident?.responder_id === user?.id;
    const isReporter = incident?.reporter_id === user?.id;
    
    if (!isResponder && !isReporter && user?.role !== 'admin') {
      addToast('Only the assigned responder or the reporter can resolve this.', 'error');
      return;
    }

    const res = await fetch(`/api/incidents/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id })
    });
    if (res.ok) {
      addToast('Incident marked as resolved.', 'success');
      fetchIncidents();
      fetchStats();
    }
  };

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-zinc-900 selection:bg-emerald-500/30">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        language={language}
        setLanguage={setLanguage}
      />


       <Sidebar
         isOpen={isSidebarOpen}
         activeTab={activeTab}
         setActiveTab={(t) => {
         setActiveTab(t);
         setIsSidebarOpen(false);
         }}
         role={user.role}
       />

      <main className="lg:ml-64 pt-40 p-8 lg:p-12 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto h-full"
          >
            {activeTab === 'dashboard' && (
              <div className="space-y-12">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-12 py-8">
                  <div className="flex-1 space-y-4 text-center lg:text-left">
                    <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-zinc-900">
                      Welcome back, <span className="text-emerald-600">{user.name.split(' ')[0]}</span>.
                    </h1>
                    <p className="text-lg text-zinc-500 max-w-xl">
                      Your safety is our priority. TRANA is actively monitoring your sector for any anomalies.
                    </p>
                  </div>
                  {isDispatching ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-48 h-48 rounded-full bg-emerald-500/10 border-4 border-emerald-500 border-t-transparent animate-spin flex items-center justify-center">
                        <Shield className="w-12 h-12 text-emerald-600 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-zinc-900 animate-pulse">Dispatching Responders...</h3>
                        <p className="text-sm text-zinc-500">Stay calm. Help is on the way.</p>
                      </div>
                    </div>
                  ) : (
                    <SOSButton onTrigger={triggerSOS} />
                  )}
                </div>
                <Dashboard 
                  user={user} 
                  stats={stats} 
                  onViewAll={() => {
                    setActiveTab('incidents');
                    addToast('Redirecting to incident logs...', 'info');
                  }} 
                />
              </div>
            )}

            {activeTab === 'map' && (
              <div className="h-[calc(100vh-16rem)] flex flex-col">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900">Crisis Mapper</h2>
                    <p className="text-sm text-zinc-500 font-medium">Real-time incident visualization and resource tracking.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => addToast('Historical Replay is currently in simulation mode.', 'info')}
                      className="px-5 py-2.5 bg-white rounded-xl border-2 border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm flex items-center gap-2 active:scale-95"
                    >
                      <History className="w-4 h-4" />
                      Historical Replay
                    </button>
                    <button className="px-5 py-2.5 bg-emerald-500 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95">
                      <Radio className="w-4 h-4 animate-pulse" />
                      Live Feed
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-[500px]">
                  <CrisisMap incidents={incidents} responderLocations={responderLocations} />
                </div>
              </div>
            )}

            {activeTab === 'safewalk' && <SafeWalk />}
            {activeTab === 'settings' && <Settings user={user} onSave={() => addToast('Profile settings saved successfully!', 'success')} />}
            
            {activeTab === 'incidents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-zinc-900">Active Incidents</h2>
                  <div className="flex gap-2">
                    {['All', 'Medical', 'Security', 'Fire'].map(f => (
                      <button 
                        key={f} 
                        onClick={() => addToast(`Filtering by ${f}...`, 'info')}
                        className="px-3 py-1 bg-white rounded-lg text-[10px] font-bold uppercase tracking-widest border border-zinc-200 hover:border-emerald-500 transition-colors shadow-sm"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {incidents.map(inc => (
                    <div key={inc.id} className="bg-white p-6 rounded-[2rem] border border-zinc-200 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900 uppercase tracking-tight">{inc.type}</h4>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">ID: #TRN-{inc.id}</p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-zinc-50 rounded-full border border-zinc-200">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">{inc.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(inc.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {inc.status === 'triggered' || inc.status === 'escalating' ? (
                          <button 
                            onClick={() => acceptIncident(inc.id)}
                            className="flex-1 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                          >
                            Accept Dispatch
                          </button>
                        ) : inc.status === 'accepted' ? (
                          <button 
                            onClick={() => resolveIncident(inc.id)}
                            className="flex-1 py-3 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                          >
                            Mark Resolved
                          </button>
                        ) : (
                          <div className="flex-1 py-3 bg-emerald-500/10 text-emerald-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Resolved
                          </div>
                        )}
                        <button 
                          onClick={() => addToast(`Fetching full report for Incident #TRN-${inc.id}...`, 'info')}
                          className="px-4 py-3 bg-zinc-50 text-zinc-500 text-xs font-bold rounded-xl hover:bg-zinc-100 transition-colors"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Toast System */}
      <div className="fixed top-20 right-8 z-[200] space-y-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[240px]",
                toast.type === 'success' ? "bg-emerald-500 text-white border-emerald-400" :
                toast.type === 'error' ? "bg-red-500 text-white border-red-400" :
                "bg-white text-zinc-900 border-zinc-200"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                toast.type === 'success' ? "bg-white animate-pulse" :
                toast.type === 'error' ? "bg-white animate-pulse" :
                "bg-emerald-500 animate-pulse"
              )} />
              <span className="text-sm font-bold">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Responder Popup */}
      <AnimatePresence>
        {activeIncidentPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-8 right-8 w-80 bg-white rounded-[2rem] border border-zinc-200 shadow-2xl z-[100] p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 uppercase tracking-tight">Help Needed!</h4>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{activeIncidentPopup.type} Incident</p>
              </div>
            </div>
            <p className="text-sm text-zinc-500 mb-6">A new emergency has been reported in your sector. Can you respond?</p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  acceptIncident(activeIncidentPopup.id);
                  setActiveIncidentPopup(null);
                }}
                className="flex-1 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                Yes, I'm on it
              </button>
              <button 
                onClick={() => setActiveIncidentPopup(null)}
                className="px-4 py-3 bg-zinc-50 text-zinc-500 text-xs font-bold rounded-xl hover:bg-zinc-100 transition-colors"
              >
                No
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
