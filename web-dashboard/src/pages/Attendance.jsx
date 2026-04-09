import React, { useState, useEffect } from 'react';
import {
  FiDownload, FiRefreshCw, FiMapPin, FiSmartphone, 
  FiClock, FiEye, FiX, FiCheckCircle, FiAlertCircle,
  FiUserCheck, FiNavigation, FiShield, FiFileText, FiFile,
  FiChevronDown, FiChevronUp, FiArrowUp, FiArrowDown, FiChevronRight,
  FiBatteryCharging, FiWifi, FiUser
} from 'react-icons/fi';
import { attendanceAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useSync, useSyncEvent } from '../hooks/useSync';
import { format, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import AgentAvatar from '../components/AgentAvatar';

// Helper function to determine device type from device name
const getDeviceType = (deviceName) => {
  if (!deviceName || deviceName === '-' || deviceName === 'Unknown') return 'Non défini';
  
  const lowerName = deviceName.toLowerCase();
  
  // Mobile devices
  if (lowerName.includes('android') || lowerName.includes('iphone') || lowerName.includes('ipad') || lowerName.includes('ios')) {
    return '📱 Téléphone';
  }
  
  // Computers
  if (lowerName.includes('windows') || lowerName.includes('mac') || lowerName.includes('linux') || lowerName.includes('pc')) {
    return '💻 PC';
  }
  
  // Other/Unknown
  return '❓ Autre';
};

// Helper functions for safe date formatting
const safeFormatDate = (dateString, formatStr = 'dd/MM/yyyy') => {
  if (!dateString) return '-';
  try {
    // Try parsing as YYYY-MM-DD format first
    const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) {
      return format(parsed, formatStr, { locale: fr });
    }
    // Try as full datetime
    const date = new Date(dateString);
    if (isValid(date)) {
      return format(date, formatStr, { locale: fr });
    }
    return '-';
  } catch (e) {
    console.error('Date parse error:', e, 'for date:', dateString);
    return '-';
  }
};

const safeFormatTime = (timeString) => {
  if (!timeString) return '-';
  try {
    // Try parsing as full DATE first (from database)
    const date = new Date(timeString);
    if (isValid(date)) {
      return format(date, 'HH:mm:ss');
    }
    // Fallback: Try parsing as HH:mm:ss format
    const parsed = parse(timeString, 'HH:mm:ss', new Date());
    if (isValid(parsed)) {
      return format(parsed, 'HH:mm:ss');
    }
    return '-';
  } catch (e) {
    console.error('Time parse error:', e, 'for time:', timeString);
    return '-';
  }
};

const Attendance = () => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [facialFilter, setFacialFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // État pour le groupement par événements et le tri
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // 🔄 WEBSOCKET - Synchronisation temps réel
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { isConnected } = useSync(user?.id, ['attendance:all', user.role === 'supervisor' ? 'supervisor' : 'agent']);

  // Notification de connexion
  useEffect(() => {
    if (isConnected) {
      toast.success('🔄 Synchronisation temps réel activée', { autoClose: 2000 });
    }
  }, [isConnected]);

  // Événement: Nouveau check-in
  useSyncEvent('checkin', ({ attendance, agent }) => {
    toast.info(`✅ ${agent.firstName} ${agent.lastName} a pointé`);
    fetchData(); // Recharger les données
  });

  // Événement: Check-out
  useSyncEvent('checkout', ({ attendance, agent }) => {
    toast.info(`🏁 ${agent.firstName} ${agent.lastName} a quitté`);
    fetchData();
  });

  // Événement: Événement mis à jour
  useSyncEvent('event:updated', (event) => {
    fetchData();
  });

  // Événement: Affectation modifiée
  useSyncEvent('assignment:updated', () => {
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, facialFilter, page]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [startDate, endDate, facialFilter, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getAll({
        page,
        limit: 50,
        startDate,
        endDate
      });

      console.log('Attendance API Response:', response);

      // Handle error responses from handleApiError
      if (response?.success === false) {
        console.error('API Error:', response.message);
        toast.error(response.message || 'Erreur lors du chargement');
        setAttendances([]);
        setStats(null);
        return;
      }

      // Handle success response - API returns response.data.attendances (not response.data.data.attendances)
      const attendanceData = response?.data?.data || response?.data;
      if (attendanceData?.attendances) {
        setAttendances(attendanceData.attendances);
        setTotalPages(attendanceData.pagination?.totalPages || 1);
        
        // Auto-expand all events when data loads
        const eventIds = [...new Set(attendanceData.attendances.map(a => a.event?.id || a.eventId || 'no-event'))];
        setExpandedEvents(new Set(eventIds));
      } else {
        console.warn('Unexpected response structure:', attendanceData);
        setAttendances([]);
      }

      try {
        const statsResponse = await attendanceAPI.getStats({ startDate, endDate });

        console.log('Stats API Response:', statsResponse);

        // Handle error responses from handleApiError
        if (statsResponse?.success === false) {
          console.warn('Stats API Error:', statsResponse.message);
          setStats(null);
        } else {
          // Backend returns stats directly in response.data.data (since backend wraps in {success, data: stats})
          const statsData = statsResponse?.data?.data;
          if (statsData) {
            setStats(statsData);
            console.log('✅ Stats loaded:', statsData);
          } else {
            console.warn('No stats data in response:', statsResponse);
            setStats(null);
          }
        }
      } catch (err) {
        console.error('Stats error:', err);
        setStats(null);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Données rafraîchies');
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Présences');

      // Headers
      worksheet.columns = [
        { header: 'Nom Agent', key: 'agentName', width: 20 },
        { header: 'Prénom', key: 'agentFirstName', width: 15 },
        { header: 'Événement', key: 'eventName', width: 25 },
        { header: 'Zone', key: 'zone', width: 20 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Heure Entrée', key: 'checkInTime', width: 15 },
        { header: 'Heure Sortie', key: 'checkOutTime', width: 15 },
        { header: 'Latitude', key: 'latitude', width: 15 },
        { header: 'Longitude', key: 'longitude', width: 15 },
        { header: 'Adresse', key: 'address', width: 30 },
        { header: 'Appareil', key: 'deviceInfo', width: 20 },
        { header: 'Heure Facial', key: 'facialVerifiedAt', width: 15 },
        { header: 'Facial Vérifié', key: 'facialVerified', width: 15 },
        { header: 'Score Match', key: 'facialMatchScore', width: 12 },
        { header: 'État', key: 'status', width: 12 },
        { header: 'Heures Travaillées', key: 'totalHours', width: 15 }
      ];

      // Add data
      filteredAttendances.forEach(record => {
        worksheet.addRow({
          agentName: record.agent?.lastName || '-',
          agentFirstName: record.agent?.firstName || '-',
          eventName: record.event?.name || '-',
          zone: record.assignment?.zone?.name || '-',
          date: safeFormatDate(record.date, 'dd/MM/yyyy'),
          checkInTime: safeFormatTime(record.checkInTime),
          checkOutTime: safeFormatTime(record.checkOutTime),
          latitude: record.checkInLatitude || '-',
          longitude: record.checkInLongitude || '-',
          address: record.checkInLatitude ? `${record.checkInLatitude}, ${record.checkInLongitude}` : '-',
          deviceInfo: record.deviceInfo ? `${record.deviceInfo.browser} / ${record.deviceInfo.os}` : '-',
          facialVerifiedAt: record.facialVerifiedAt ? safeFormatDate(record.facialVerifiedAt, 'dd/MM/yyyy HH:mm:ss') : '-',
          facialVerified: record.facialVerified ? 'Oui' : 'Non',
          facialMatchScore: record.facialMatchScore ? `${Math.round(record.facialMatchScore * 100)}%` : '-',
          status: record.status || '-',
          totalHours: record.totalHours || '-'
        });
      });

      // Style header
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      await workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `presences_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        toast.success('✅ Fichier Excel exporté');
      });
    } catch (error) {
      console.error('Export Excel error:', error);
      toast.error('Erreur lors de l\'export Excel');
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      doc.setFontSize(16);
      doc.text('Rapport de Présences', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date range
      doc.setFontSize(10);
      doc.text(`Période: ${startDate} à ${endDate}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Stats
      doc.setFontSize(11);
      doc.text(`Total: ${stats?.total || 0} | Présents: ${stats?.present || 0} | Absents: ${stats?.absent || 0} | Vérification Faciale: ${stats?.facialVerified || 0}`, 15, yPosition);
      yPosition += 12;

      // Table headers
      const headers = ['Agent', 'Événement', 'Zone', 'Date', 'Entrée', 'Sortie', 'Latitude', 'Longitude', 'État', 'Facial'];
      const colWidth = (pageWidth - 30) / headers.length;

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(59, 130, 246);

      headers.forEach((header, index) => {
        doc.rect(15 + index * colWidth, yPosition, colWidth, 10, 'F');
        doc.text(header, 15 + index * colWidth + 2, yPosition + 7);
      });
      yPosition += 12;

      // Table data
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);

      filteredAttendances.slice(0, 20).forEach(record => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }

        const data = [
          `${record.agent?.firstName || ''} ${record.agent?.lastName || ''}`,
          record.event?.name || '-',
          record.assignment?.zone?.name || '-',
          safeFormatDate(record.date, 'dd/MM/yyyy'),
          safeFormatTime(record.checkInTime),
          safeFormatTime(record.checkOutTime),
          `${record.checkInLatitude || '-'}`,
          `${record.checkInLongitude || '-'}`,
          record.status || '-',
          record.facialVerified ? '✓' : '✗'
        ];

        data.forEach((cell, index) => {
          doc.text(cell, 15 + index * colWidth + 2, yPosition);
        });
        yPosition += 8;
      });

      doc.save(`presences_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('✅ Fichier PDF exporté');
    } catch (error) {
      console.error('Export PDF error:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  const filteredAttendances = attendances.filter(a => {
    if (facialFilter === 'verified') return a.facialVerified === true;
    if (facialFilter === 'notVerified') return a.facialVerified === false || !a.facialVerified;
    return true;
  });

  // Fonction de tri
  const sortData = (data) => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortConfig.key) {
        case 'agent':
          aValue = `${a.agent?.firstName || ''} ${a.agent?.lastName || ''}`.toLowerCase();
          bValue = `${b.agent?.firstName || ''} ${b.agent?.lastName || ''}`.toLowerCase();
          break;
        case 'event':
          aValue = (a.event?.name || '').toLowerCase();
          bValue = (b.event?.name || '').toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'checkInTime':
          aValue = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          bValue = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          break;
        case 'checkOutTime':
          aValue = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
          bValue = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        case 'facial':
          aValue = a.facialVerified ? 1 : 0;
          bValue = b.facialVerified ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Grouper par événements
  const groupedByEvent = filteredAttendances.reduce((acc, record) => {
    const eventKey = record.event?.id || record.eventId || 'no-event';
    const eventName = record.event?.name || 'Sans événement';
    
    if (!acc[eventKey]) {
      acc[eventKey] = {
        eventId: eventKey,
        eventName: eventName,
        event: record.event,
        records: []
      };
    }
    
    acc[eventKey].records.push(record);
    return acc;
  }, {});

  const eventGroups = Object.values(groupedByEvent).map(group => ({
    ...group,
    records: sortData(group.records)
  }));

  // Fonction pour toggler l'expansion d'un événement
  const toggleEvent = (eventId) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  // Fonction pour gérer le tri
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Composant pour l'icône de tri
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? 
      <FiArrowUp className="inline ml-1" size={14} /> : 
      <FiArrowDown className="inline ml-1" size={14} />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present':
        return '✓ Présent';
      case 'absent':
        return '✗ Absent';
      case 'late':
        return '⚠ Retard';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">📊 État de Présence</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (expandedEvents.size === eventGroups.length) {
                setExpandedEvents(new Set());
              } else {
                setExpandedEvents(new Set(eventGroups.map(g => g.eventId)));
              }
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            title={expandedEvents.size === eventGroups.length ? "Tout Replier" : "Tout Développer"}
          >
            {expandedEvents.size === eventGroups.length ? (
              <>
                <FiChevronUp size={18} />
                Tout Replier
              </>
            ) : (
              <>
                <FiChevronDown size={18} />
                Tout Développer
              </>
            )}
          </button>
          <button
            onClick={exportToExcel}
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            title="Télécharger en Excel"
          >
            <FiDownload size={18} />
            Excel
          </button>
          <button
            onClick={exportToPDF}
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            title="Télécharger en PDF"
          >
            <FiDownload size={18} />
            PDF
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} size={18} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-semibold">Total Pointages</p>
            <p className="text-3xl font-bold text-blue-900">{stats.total || 0}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-semibold">Présents</p>
            <p className="text-3xl font-bold text-green-900">{stats.present || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600 font-semibold">Absents</p>
            <p className="text-3xl font-bold text-red-900">{stats.absent || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-semibold">Vérification Faciale</p>
            <p className="text-3xl font-bold text-yellow-900">{stats.facialVerified || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <h2 className="font-bold text-gray-900">Filtres</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vérification Faciale
            </label>
            <select
              value={facialFilter}
              onChange={(e) => setFacialFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tous</option>
              <option value="verified">✓ Vérifiés</option>
              <option value="notVerified">✗ Non Vérifiés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Chargement des données...
          </div>
        ) : filteredAttendances.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucune donnée de présence trouvée
          </div>
        ) : eventGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun groupe d'événements trouvé
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="p-4 bg-blue-50 text-sm">
              📊 {eventGroups.length} événement(s) - {filteredAttendances.length} pointage(s)
            </div>
            {/* En-tête du tableau avec tri */}
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('agent')}>
                    Agent <SortIcon columnKey="agent" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('event')}>
                    Événement <SortIcon columnKey="event" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Zone</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('date')}>
                    Date <SortIcon columnKey="date" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('checkInTime')}>
                    Heure Entrée <SortIcon columnKey="checkInTime" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('checkOutTime')}>
                    Heure Sortie <SortIcon columnKey="checkOutTime" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>
                    État <SortIcon columnKey="status" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('facial')}>
                    Facial <SortIcon columnKey="facial" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Type Appareil</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Adresse IP</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Adresse MAC</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
            </table>

            {/* Corps du tableau groupé par événements */}
            {eventGroups.map(group => (
              <div key={group.eventId} className="border-b border-gray-300">
                {/* En-tête du groupe d'événements */}
                <div 
                  className="bg-blue-50 border-y border-blue-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => toggleEvent(group.eventId)}
                >
                  <div className="flex items-center gap-3">
                    {expandedEvents.has(group.eventId) ? (
                      <FiChevronDown className="text-blue-600 transition-transform" size={20} />
                    ) : (
                      <FiChevronRight className="text-blue-600 transition-transform" size={20} />
                    )}
                    <h3 className="font-bold text-gray-900 text-base">
                      {group.eventName}
                    </h3>
                    <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      {group.records.length} pointage{group.records.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {group.event && (
                    <div className="text-sm text-gray-600">
                      📍 {group.event.location || 'Emplacement non défini'}
                    </div>
                  )}
                </div>

                {/* Lignes de l'événement (affichées si expanded) */}
                {expandedEvents.has(group.eventId) && (
                  <div className="animate-fadeIn">
                    <table className="w-full text-sm">
                      <tbody>
                        {group.records.map((record) => (
                          <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <AgentAvatar
                                  photo={record.agent?.profilePhoto}
                                  firstName={record.agent?.firstName}
                                  lastName={record.agent?.lastName}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{record.agent?.firstName || '-'} {record.agent?.lastName || '-'}</div>
                                  <div className="text-xs text-gray-500">{record.agent?.employeeId || record.agentId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{record.event?.name || record.eventId || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                <div className="flex items-center gap-2">
                                  {record.assignment?.zone?.color && (
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: record.assignment.zone.color }}
                                    />
                                  )}
                                  <span className="text-gray-900">{record.assignment?.zone?.name || '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {safeFormatDate(record.date, 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {safeFormatTime(record.checkInTime)}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {safeFormatTime(record.checkOutTime)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                                {getStatusLabel(record.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {record.facialVerified ? (
                                  <FiCheckCircle className="text-green-600" size={18} title="Vérification faciale réussie" />
                                ) : (
                                  <FiAlertCircle className="text-red-600" size={18} title="Pas de vérification faciale" />
                                )}
                                <span className="text-xs text-gray-600">
                                  {record.facialVerified ? '✓' : '✗'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                  {getDeviceType(record.checkInDeviceName)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700 font-mono">
                                {record.checkInDeviceIP || <span className="text-gray-400 italic">Non capturé</span>}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-gray-600 font-mono break-all">
                                {record.checkInDeviceMAC ? (
                                  record.checkInDeviceMAC.length > 20 ? 
                                    record.checkInDeviceMAC.substring(0, 20) + '...' : 
                                    record.checkInDeviceMAC
                                ) : (
                                  <span className="text-gray-400 italic">Non capturé</span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  setSelectedRow(record);
                                  setShowDetailsModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                              >
                                <FiEye size={16} />
                                Voir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Détails du Pointage</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">📋 Détails du Pointage</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Agent Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">👤 Informations Agent</h3>
              {/* Photos: profil de création + photo de pointage facial */}
              <div className="flex items-start gap-6 mb-4">
                <div className="flex flex-col items-center gap-1">
                  <AgentAvatar
                    photo={selectedRow.agent?.profilePhoto}
                    firstName={selectedRow.agent?.firstName}
                    lastName={selectedRow.agent?.lastName}
                    size="xl"
                  />
                  <span className="text-xs text-gray-500 font-medium">Photo de profil</span>
                </div>
                {selectedRow.checkInPhoto && (
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={selectedRow.checkInPhoto.startsWith('data:') ? selectedRow.checkInPhoto : `data:image/jpeg;base64,${selectedRow.checkInPhoto}`}
                      alt="Photo check-in"
                      className="w-20 h-20 rounded-full object-cover border-2 border-blue-300"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span className="text-xs text-blue-600 font-medium">Photo check-in</span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">Prénom</p>
                      <p className="font-semibold text-gray-900">{selectedRow.agent?.firstName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">Nom</p>
                      <p className="font-semibold text-gray-900">{selectedRow.agent?.lastName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">ID Employé</p>
                      <p className="font-semibold text-gray-900">{selectedRow.agent?.employeeId || selectedRow.agentId || '-'}</p>
                    </div>
                    {selectedRow.agent?.phone && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">Téléphone</p>
                        <p className="font-semibold text-gray-900">{selectedRow.agent.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Event Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📍 Événement</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Nom Événement</p>
                  <p className="font-semibold text-gray-900">{selectedRow.event?.name || selectedRow.eventId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">ID Événement</p>
                  <p className="font-semibold text-gray-900">{selectedRow.eventId || '-'}</p>
                </div>
              </div>
            </div>

            {/* Attendance Times */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">⏰ Heures de Pointage</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Date</p>
                  <p className="font-semibold text-gray-900">{safeFormatDate(selectedRow.date, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Heure Entrée</p>
                  <p className="font-semibold text-gray-900">{safeFormatTime(selectedRow.checkInTime)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Heure Sortie</p>
                  <p className="font-semibold text-gray-900">{safeFormatTime(selectedRow.checkOutTime)}</p>
                </div>
              </div>
            </div>

            {/* Geolocation Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🌍 Géolocalisation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Latitude Entrée</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-900">{selectedRow.checkInLatitude || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Longitude Entrée</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-900">{selectedRow.checkInLongitude || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Latitude Sortie</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-900">{selectedRow.checkOutLatitude || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Longitude Sortie</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-900">{selectedRow.checkOutLongitude || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Distance à l'Événement</p>
                  <p className="font-semibold text-lg text-blue-600">{selectedRow.distanceFromLocation ? `${Math.round(selectedRow.distanceFromLocation)}m` : '-'}</p>
                </div>
              </div>
            </div>

            {/* Device Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📱 Informations Appareil</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Type d'Appareil</p>
                  <p className="font-semibold text-gray-900">{getDeviceType(selectedRow.checkInDeviceName)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Nom de l'Appareil</p>
                  <p className="font-semibold text-gray-900">{selectedRow.checkInDeviceName || <span className="text-gray-400 italic">Non capturé</span>}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Adresse IP</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded text-gray-900">
                    {selectedRow.checkInDeviceIP || <span className="text-gray-400 italic not-italic">Non capturé</span>}
                  </p>
                  {selectedRow.checkInDeviceIP?.includes('localhost') && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Accès via localhost - l'IP réelle n'est pas visible
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    ID Appareil (Empreinte Numérique)
                    <span className="text-gray-400 font-normal ml-1" title="L'adresse MAC réelle n'est pas accessible depuis un navigateur web pour des raisons de sécurité">ℹ️</span>
                  </p>
                  <p className="font-mono text-xs bg-gray-100 p-2 rounded text-gray-900 break-all">
                    {selectedRow.checkInDeviceMAC || selectedRow.deviceFingerprint || <span className="text-gray-400 italic not-italic">Non capturé</span>}
                  </p>
                  {(selectedRow.checkInDeviceMAC || selectedRow.deviceFingerprint) && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 Ceci est une empreinte numérique unique, pas une adresse MAC réelle
                    </p>
                  )}
                </div>
                {selectedRow.deviceFingerprint && selectedRow.checkInDeviceMAC && (
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Empreinte Appareil Complète</p>
                    <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all text-gray-900">{selectedRow.deviceFingerprint}</p>
                  </div>
                )}
                {selectedRow.deviceInfo && typeof selectedRow.deviceInfo === 'object' && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">Navigateur</p>
                      <p className="font-semibold text-gray-900">{selectedRow.deviceInfo.browser || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">Système d'Exploitation</p>
                      <p className="font-semibold text-gray-900">{selectedRow.deviceInfo.os || '-'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Facial Recognition Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">👁️ Reconnaissance Faciale</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Vérification Faciale</p>
                  <p className={`font-bold text-lg ${selectedRow.facialVerified ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRow.facialVerified ? '✓ Vérifiée' : '✗ Non vérifiée'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Heure Vérification</p>
                  <p className="font-semibold text-gray-900">
                    {selectedRow.facialVerifiedAt ? safeFormatDate(selectedRow.facialVerifiedAt, 'dd/MM/yyyy HH:mm:ss') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Score de Correspondance</p>
                  <p className="font-bold text-lg">
                    {selectedRow.facialMatchScore ? `${Math.round(selectedRow.facialMatchScore * 100)}%` : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status and Additional Info */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">ℹ️ État et Autres Informations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">État de Présence</p>
                  <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedRow.status)}`}>
                    {getStatusLabel(selectedRow.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Dans la Géozone</p>
                  <p className={`font-bold text-lg ${selectedRow.isWithinGeofence ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRow.isWithinGeofence ? '✓ Oui' : '✗ Non'}
                  </p>
                </div>
              </div>
            </div>

            {/* 📡 Données mobiles enrichies */}
            {(selectedRow.batteryLevel != null || selectedRow.networkType || selectedRow.checkInSpeed != null || selectedRow.checkInAltitude != null) && (
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📡 Données Mobiles (Check-in)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedRow.batteryLevel != null && (
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <FiBatteryCharging size={12} /> Batterie
                      </span>
                      <span className={`font-bold text-lg ${selectedRow.batteryLevel >= 50 ? 'text-green-600' : selectedRow.batteryLevel >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {Math.round(selectedRow.batteryLevel)}%
                      </span>
                    </div>
                  )}
                  {selectedRow.networkType && (
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <FiWifi size={12} /> Réseau
                      </span>
                      <span className="font-bold text-gray-900">{selectedRow.networkType}</span>
                    </div>
                  )}
                  {selectedRow.checkInSpeed != null && (
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <FiNavigation size={12} /> Vitesse
                      </span>
                      <span className="font-bold text-gray-900">{Math.round((selectedRow.checkInSpeed || 0) * 3.6)} km/h</span>
                    </div>
                  )}
                  {selectedRow.checkInAltitude != null && (
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Altitude</span>
                      <span className="font-bold text-gray-900">{Math.round(selectedRow.checkInAltitude)} m</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              >
                Fermer
              </button>
              <button
                onClick={exportToExcel}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <FiDownload size={16} />
                Exporter
              </button>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
