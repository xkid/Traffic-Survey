import React, { useMemo } from 'react';
import { SurveyRow } from '../types';

interface SurveyFormProps {
  data: SurveyRow[];
  intersectionName?: string;
}

export const SurveyForm: React.FC<SurveyFormProps> = ({ data, intersectionName = "Generic Intersection" }) => {
  
  // Create 20 empty rows if data is less than 20
  const displayRows = useMemo(() => {
    const rows = [...data];
    while (rows.length < 20) {
      rows.push({
        cycleNumber: rows.length + 1,
        startHour: '', startMin: '', startSec: '',
        Ni: 0, Nr: 0, Ng: 0, Nb: 0, No: 0
      });
    }
    return rows.slice(0, 20); // Limit to 20 for the view like the form
  }, [data]);

  // Calculations for percentiles and averages
  const validData = data.length > 0 ? data : [];
  
  const calculateAverage = (key: keyof Pick<SurveyRow, 'Ni' | 'Nr' | 'Ng' | 'Nb' | 'No'>) => {
    if (validData.length === 0) return 0;
    const sum = validData.reduce((acc, row) => acc + (row[key] || 0), 0);
    return (sum / validData.length).toFixed(1);
  };

  const calculatePercentile = (key: keyof Pick<SurveyRow, 'Ni' | 'Nr' | 'Ng' | 'Nb' | 'No'>, p: number) => {
    if (validData.length === 0) return 0;
    const values = validData.map(r => r[key] || 0).sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[index];
  };

  const renderCell = (value: number | string) => (
    value === 0 || value === '' ? '' : value
  );

  return (
    <div className="w-full overflow-x-auto p-4 bg-white shadow-xl rounded-sm border border-sidra-border">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-sidra-headerText uppercase tracking-wide">Queue Survey Form</h2>
      </div>

      {/* Header Info */}
      <div className="grid grid-cols-2 border-2 border-sidra-border mb-0.5">
        <div className="bg-sidra-header p-2 border-r border-sidra-border flex">
          <span className="font-bold text-sidra-headerText w-32">Intersection:</span>
          <span className="flex-1 border-b border-dotted border-gray-600">{intersectionName}</span>
        </div>
        <div className="grid grid-cols-2">
            <div className="bg-sidra-header p-2 border-r border-sidra-border flex">
                 <span className="font-bold text-sidra-headerText w-16">Date:</span>
                 <span className="flex-1 border-b border-dotted border-gray-600">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="bg-sidra-header p-2 flex">
                <span className="font-bold text-sidra-headerText w-16">Time:</span>
                <span className="flex-1 border-b border-dotted border-gray-600">
                    {validData.length > 0 ? `${validData[0].startHour}:${validData[0].startMin}` : ''}
                </span>
            </div>
        </div>
      </div>

      {/* Main Table */}
      <table className="w-full border-collapse border-2 border-sidra-border text-center text-sm">
        <thead>
          <tr className="bg-sidra-header text-sidra-headerText">
            <th rowSpan={2} className="border border-sidra-border p-1 w-12 font-bold">Cycle Number</th>
            <th colSpan={3} className="border border-sidra-border p-1 font-bold">Cycle Start Time <br/><span className="font-normal text-xs">(start of Red)</span></th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Queue at Start of RED</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Queue at Start of GREEN / GAP</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Back of Queue Count</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Back of Queue</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Overflow Queue <br/><span className="font-normal text-xs">(at the End of Green)</span></th>
          </tr>
          <tr className="bg-sidra-header text-sidra-headerText">
             <th className="border border-sidra-border w-8 font-bold">H</th>
             <th className="border border-sidra-border w-8 font-bold">M</th>
             <th className="border border-sidra-border w-8 font-bold">S</th>
             <th className="border border-sidra-border w-24 font-bold">(veh)<br/>N<sub>i</sub></th>
             <th className="border border-sidra-border w-24 font-bold">(veh)<br/>N<sub>r</sub></th>
             <th className="border border-sidra-border w-24 font-bold">(veh)<br/>N<sub>g</sub></th>
             <th className="border border-sidra-border w-24 font-bold">(veh)<br/>N<sub>b</sub></th>
             <th className="border border-sidra-border w-24 font-bold">(veh)<br/>N<sub>o</sub></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => (
            <tr key={idx} className="bg-sidra-cell h-8 hover:bg-yellow-100 transition-colors">
              <td className="border border-sidra-border font-bold text-sidra-headerText">{row.cycleNumber}</td>
              <td className="border border-sidra-border">{row.startHour}</td>
              <td className="border border-sidra-border">{row.startMin}</td>
              <td className="border border-sidra-border">{row.startSec}</td>
              <td className="border border-sidra-border">{renderCell(row.Ni)}</td>
              <td className="border border-sidra-border">{renderCell(row.Nr)}</td>
              <td className="border border-sidra-border">{renderCell(row.Ng)}</td>
              <td className="border border-sidra-border font-medium">{renderCell(row.Nb)}</td>
              <td className="border border-sidra-border">{renderCell(row.No)}</td>
            </tr>
          ))}

          {/* Statistics Footer */}
          <tr className="bg-gray-100 text-sidra-headerText font-semibold border-t-2 border-sidra-border">
            <td colSpan={4} className="border border-sidra-border text-right pr-4 py-1">98th percentile</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nr', 98)}</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nb', 98)}</td>
            <td className="border border-sidra-border"></td>
          </tr>
          <tr className="bg-gray-100 text-sidra-headerText font-semibold">
            <td colSpan={4} className="border border-sidra-border text-right pr-4 py-1">95th percentile</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nr', 95)}</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nb', 95)}</td>
            <td className="border border-sidra-border"></td>
          </tr>
          <tr className="bg-gray-100 text-sidra-headerText font-semibold">
            <td colSpan={4} className="border border-sidra-border text-right pr-4 py-1">90th percentile</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nr', 90)}</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nb', 90)}</td>
            <td className="border border-sidra-border"></td>
          </tr>
          <tr className="bg-gray-100 text-sidra-headerText font-semibold">
            <td colSpan={4} className="border border-sidra-border text-right pr-4 py-1">85th percentile</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nr', 85)}</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculatePercentile('Nb', 85)}</td>
            <td className="border border-sidra-border"></td>
          </tr>
          <tr className="bg-gray-100 text-sidra-headerText font-bold">
            <td colSpan={4} className="border border-sidra-border text-right pr-4 py-1">Average</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculateAverage('Nr')}</td>
            <td className="border border-sidra-border bg-gray-200"></td>
            <td className="border border-sidra-border">{calculateAverage('Nb')}</td>
            <td className="border border-sidra-border"></td>
          </tr>
        </tbody>
      </table>

      {/* Field Notes Section */}
      <div className="mt-6 bg-sidra-header p-4 border border-sidra-border">
          <h3 className="font-bold text-sidra-headerText mb-2">Field Notes:</h3>
          <div className="space-y-4">
              <div className="border-b border-dotted border-gray-400 h-6"></div>
              <div className="border-b border-dotted border-gray-400 h-6"></div>
              <div className="border-b border-dotted border-gray-400 h-6"></div>
          </div>
      </div>
    </div>
  );
};