import React from 'react';

function Tabs({ tabs, selectedTab, onTabSelect }) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar mb-2">
      <div className="flex space-x-2 rtl:space-x-reverse">
        <button className={`flex-shrink-0 ml-2 px-4 py-2 rounded-lg ${selectedTab === 'supermarket' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`} onClick={() => onTabSelect('supermarket')}>
          سوبرماركت
        </button>

        {tabs.map((tab) => (
          <button key={tab._id} className={`flex-shrink-0 px-4 py-2 rounded-lg ${selectedTab === tab._id ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`} onClick={() => onTabSelect(tab._id)}>
            {tab.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Tabs;
