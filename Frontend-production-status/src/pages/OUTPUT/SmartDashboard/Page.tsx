import React from 'react';
import ChartTemplate from './components/Chart';
import './overview.css';

const Page: React.FC = () => {
  return (
    <div className="w-full h-full p-4 overflow-y-auto bg-base-200 text-base-content">
      <ChartTemplate />
    </div>
  );
};

export default Page;
