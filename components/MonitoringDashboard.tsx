import React, { useState, useEffect } from 'react';
import type { SystemLog, VersionInfo, ConnectivityService } from '../types.ts';
import { CpuChipIcon, CircleStackIcon, HddIcon, TimeIcon, ShieldCheckIcon, WifiIcon, TrashIcon, BugAntIcon } from './Icons.tsx';

interface MonitoringDashboardProps {
    systemLogs: SystemLog[];
    versionInfo: VersionInfo;
    connectivityServices: ConnectivityService[];
}

type HealthStatus = 'UP' | 'DEGRADED' | 'DOWN';
type ConnectivityStatus = 'idle' | 'testing' | 'success' | 'failure';

const HealthStatusIndicator: React.FC<{ status: HealthStatus }> = ({ status }) => {
    const config = {
        UP: { text: 'Opérationnel', color: 'bg-green-500', pulseColor: 'bg-green-400' },
        DEGRADED: { text: 'Performance Dégradée', color: 'bg-yellow-500', pulseColor: 'bg-yellow-400' },
        DOWN: { text: 'Panne Majeure', color: 'bg-red-500', pulseColor: 'bg-red-400' },
    };
    const { text, color, pulseColor } = config[status];

    return (
        <div className="flex items-center">
            <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`}></span>
            </span>
            <span className="ml-3 font-semibold text-slate-700">{text}</span>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.FC<any>; children?: React.ReactNode }> = ({ title, value, icon: Icon, children }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-600">{title}</h3>
            <Icon className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        {children}
    </div>
);

const ConnectivityTester: React.FC<{ services: ConnectivityService[] }> = ({ services }) => {
    const [statuses, setStatuses] = useState<Record<string, { status: ConnectivityStatus; latency?: number }>>({});

    const runTest = (serviceId: string) => {
        setStatuses(prev => ({ ...prev, [serviceId]: { status: 'testing' } }));
        setTimeout(() => {
            const success = Math.random() > 0.15; // 85% success rate
            setStatuses(prev => ({
                ...prev,
                [serviceId]: {
                    status: success ? 'success' : 'failure',
                    latency: success ? Math.floor(Math.random() * 150) + 20 : undefined,
                },
            }));
        }, Math.random() * 1500 + 500);
    };

    const getStatusIndicator = (status: ConnectivityStatus) => {
        switch (status) {
            case 'success': return <div className="w-3 h-3 rounded-full bg-green-500" title="Succès"></div>;
            case 'failure': return <div className="w-3 h-3 rounded-full bg-red-500" title="Échec"></div>;
            case 'testing': return <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" title="Test en cours..."></div>;
            default: return <div className="w-3 h-3 rounded-full bg-slate-300" title="Inactif"></div>;
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Testeur de Connectivité</h3>
            <div className="space-y-2">
                {services.map(service => (
                    <div key={service.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                        <div className="flex items-center">
                            {getStatusIndicator(statuses[service.id]?.status || 'idle')}
                            <div className="ml-3">
                                <p className="font-medium text-sm text-slate-700">{service.name}</p>
                                <p className="text-xs text-slate-500 font-mono">{service.target}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             {statuses[service.id]?.status === 'success' && (
                                <span className="text-sm font-mono text-green-700">{statuses[service.id]?.latency}ms</span>
                            )}
                             {statuses[service.id]?.status === 'failure' && (
                                <span className="text-sm font-semibold text-red-600">Échec</span>
                            )}
                            <button onClick={() => runTest(service.id)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800" disabled={statuses[service.id]?.status === 'testing'}>
                                {statuses[service.id]?.status === 'testing' ? '...' : 'Tester'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ systemLogs, versionInfo, connectivityServices }) => {
    const [stats, setStats] = useState({ cpu: 0, ram: 0, disk: 0, latency: 0 });
    const [health, setHealth] = useState<HealthStatus>('UP');
    const [latencyHistory, setLatencyHistory] = useState<number[]>(Array(20).fill(0));

    useEffect(() => {
        const interval = setInterval(() => {
            const cpu = Math.random() * 50 + 10;
            const ram = Math.random() * 30 + 50;
            const disk = 75.8;
            const baseLatency = health === 'DEGRADED' ? 150 : 30;
            const latency = Math.random() * 50 + baseLatency;

            setStats({
                cpu: parseFloat(cpu.toFixed(1)),
                ram: parseFloat(ram.toFixed(1)),
                disk: disk,
                latency: Math.round(latency),
            });
            
            setLatencyHistory(prev => [...prev.slice(1), latency]);

            if (cpu > 80 || ram > 90) setHealth('DEGRADED');
            else if (Math.random() > 0.995) setHealth('DOWN');
            else setHealth('UP');

        }, 2000);
        return () => clearInterval(interval);
    }, [health]);

    const logConfig = {
        INFO: { color: 'bg-sky-100 text-sky-800', icon: ShieldCheckIcon },
        WARNING: { color: 'bg-yellow-100 text-yellow-800', icon: WifiIcon },
        ERROR: { color: 'bg-red-100 text-red-800', icon: BugAntIcon },
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">État du Système</h2>
                <HealthStatusIndicator status={health} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Charge CPU" value={`${stats.cpu}%`} icon={CpuChipIcon}>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.cpu}%` }}></div></div>
                </StatCard>
                <StatCard title="Utilisation RAM" value={`${stats.ram}%`} icon={CircleStackIcon}>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2"><div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${stats.ram}%` }}></div></div>
                </StatCard>
                <StatCard title="Espace Disque" value={`${stats.disk}%`} icon={HddIcon}>
                     <div className="w-full bg-slate-200 rounded-full h-2 mt-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.disk}%` }}></div></div>
                </StatCard>
                <StatCard title="Latence API" value={`${stats.latency}ms`} icon={TimeIcon}>
                    <div className="h-8 mt-2 flex items-end gap-0.5">
                        {latencyHistory.map((val, i) => (
                             <div key={i} className="w-full bg-indigo-300" style={{ height: `${Math.min(100, val / 2)}%` }}></div>
                        ))}
                    </div>
                </StatCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Journal des Événements Système</h3>
                    <div className="space-y-2 h-72 overflow-y-auto pr-2">
                        {systemLogs.map(log => {
                            const Icon = logConfig[log.level].icon;
                            return (
                                <div key={log.id} className={`flex items-start text-sm p-2 rounded-md ${logConfig[log.level].color}`}>
                                    <Icon className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-mono text-xs opacity-70 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="font-semibold mr-2">[{log.service}]</span>
                                        <span>{log.message}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                 <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-3">Versions</h3>
                        <ul className="text-sm space-y-2">
                            {Object.entries(versionInfo).map(([key, value]) => (
                                <li key={key} className="flex justify-between">
                                    <span className="capitalize text-slate-600">{key}</span>
                                    <span className="font-mono font-semibold text-slate-700">{value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button className="w-full flex items-center justify-center gap-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg">
                        <TrashIcon className="w-4 h-4"/>
                        Purger les anciens logs
                    </button>
                 </div>
            </div>

            <ConnectivityTester services={connectivityServices} />
        </div>
    );
};

export default MonitoringDashboard;