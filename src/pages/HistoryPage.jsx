import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Download } from 'lucide-react';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import db from '../pouchdb';

const HistoryPage = () => {
  const navigate = useNavigate();
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [activities, setActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [userFilter, setUserFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [posDate, setPosDate] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const posTerminal = localStorage.getItem('posTerminal');

        // Fetch POS date from settings
        const settingsResult = await db.query('pos_index/pos_settings_by_all', {
          reduce: false,
          descending: true,
          limit: 1,
        });

        let posDateStart = new Date();
        if (settingsResult.rows.length > 0) {
          const settings = settingsResult.rows[0].value;
          posDateStart = new Date(settings.pos_date);
          setPosDate(settings.pos_date);
        }
        posDateStart.setHours(0, 0, 0, 0);

        const result = await db.find({
          selector: {
            document_type: 'log',
            terminal_id: posTerminal,
            created_at: {
              $gte: posDateStart.toISOString(),
            },
          },
        });

        const fetchedActivities = result.docs.map((doc) => ({
          name: doc.statement,
          time: new Date(doc.created_at).toLocaleTimeString('ar-SA'),
          timestamp: new Date(doc.created_at).getTime(),
          userType: 'regular',
        }));

        setActivities(fetchedActivities);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  // Filter and sort activities
  const filteredActivities = activities
    .filter((activity) => {
      const matchesSearch = (activity.name?.toLowerCase().includes(searchTerm.toLowerCase()) || activity.status?.toLowerCase().includes(searchTerm.toLowerCase())) ?? false;
      const matchesUserFilter = userFilter === 'all' || activity.userType === userFilter;
      return matchesSearch && matchesUserFilter;
    })
    .sort((a, b) => {
      return sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentShift');
    navigate('/');
  };

  const handleExport = () => {
    // Add UTF-8 BOM
    const BOM = '\uFEFF';

    const csvContent = BOM + activities.map((activity) => `${activity.name},${activity.time}`).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activities.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans" dir="rtl">
      <Sidebar showMainSidebar={showMainSidebar} toggleMainSidebar={toggleMainSidebar} />
      <Header toggleMainSidebar={toggleMainSidebar} handleLogout={handleLogout} />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">السجل</h2>
            <span className="text-sm text-gray-500">جميع السجلات لهذا اليوم</span>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')} className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                  ترتيب حسب: {sortOrder === 'newest' ? 'الأحدث' : 'الأقدم'}
                </button>
              </div>

              {/* <div className="relative">
                <button 
                  onClick={() => setUserFilter(userFilter === "all" ? "supervisor" : "all")}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  {userFilter === "all" ? "جميع المستخدمين" : "المشرفين"}
                </button>
              </div> */}
            </div>

            <div className="relative">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="سجل البحث" className="bg-gray-50 rounded-lg py-2.5 px-4 pl-10 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm text-right">
              <thead className="text-xs uppercase bg-[#F5F9FF]">
                <tr>
                  <th scope="col" className="px-6 py-4 text-[#4F5E83] font-medium text-base">
                    اسم المستخدم
                  </th>
                  <th scope="col" className="px-6 py-4 text-[#4F5E83] font-medium text-base">
                    الوقت
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="3" className="text-center py-4">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((activity, index) => {
                    return (
                      <tr key={index} className="bg-white border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${activity.userType === 'supervisor' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                          {activity.name}
                          {activity.userType === 'supervisor' && <span className="text-orange-500 text-xs mr-2 bg-orange-50 px-2 py-0.5 rounded">مشرف</span>}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{activity.time}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <button onClick={handleExport} className="mt-6 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" />
            تصدير
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
