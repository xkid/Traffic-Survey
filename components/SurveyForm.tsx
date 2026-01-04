import React, { useMemo } from 'react';
import { SurveyRow, IntersectionType } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SurveyFormProps {
  data: SurveyRow[];
  intersectionName?: string;
  intersectionType: IntersectionType;
}

export const SurveyForm: React.FC<SurveyFormProps> = ({ data, intersectionName = "Generic Intersection", intersectionType }) => {
  
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

  // --- LABELS BASED ON INTERSECTION TYPE ---
  const isSignalised = intersectionType === 'SIGNALISED';
  const labelQueueStartGreen = isSignalised ? "Queue at Start of GREEN" : "Queue at Start of GAP";
  const labelOverflow = isSignalised ? "Overflow Queue (End of Green)" : "Overflow Queue (End of Gap)";
  const labelCycleTime = isSignalised ? "Cycle Start Time (Start of Red)" : "Cycle Start Time (Queue Start)";

  // --- EXPORT FUNCTIONS ---
  
  const handleExportCSV = () => {
    const headers = [
      "Cycle Number", 
      "Start Hour", "Start Min", "Start Sec", 
      "Ni (Queue Start Red/Wait)", 
      `Nr (${isSignalised ? 'Start Green' : 'Start Gap'})`, 
      "Ng (Arrivals)", 
      "Nb (Back of Queue)", 
      "No (Overflow)"
    ];

    const csvRows = data.map(row => [
      row.cycleNumber,
      row.startHour, row.startMin, row.startSec,
      row.Ni, row.Nr, row.Ng, row.Nb, row.No
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sidra_survey_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header Info
    doc.setFontSize(14);
    doc.setTextColor(31, 58, 138); // Text sidra-headerText (blue)
    doc.text("QUEUE SURVEY FORM", 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Intersection: ${intersectionName}`, 14, 25);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 25);
    
    // Construct Body Data
    const bodyData = displayRows.map(row => [
        row.cycleNumber,
        row.startHour,
        row.startMin,
        row.startSec,
        renderCell(row.Ni),
        renderCell(row.Nr),
        renderCell(row.Ng),
        renderCell(row.Nb),
        renderCell(row.No)
    ]);

    // Construct Footer (Stats) rows
    const statsRows = [
        ["98th percentile", "", "", "", "", calculatePercentile('Nr', 98), "", calculatePercentile('Nb', 98), ""],
        ["95th percentile", "", "", "", "", calculatePercentile('Nr', 95), "", calculatePercentile('Nb', 95), ""],
        ["90th percentile", "", "", "", "", calculatePercentile('Nr', 90), "", calculatePercentile('Nb', 90), ""],
        ["85th percentile", "", "", "", "", calculatePercentile('Nr', 85), "", calculatePercentile('Nb', 85), ""],
        ["Average", "", "", "", "", calculateAverage('Nr'), "", calculateAverage('Nb'), ""]
    ];

    // Colors
    const colorHeaderBg = [253, 251, 229]; // #FDFBE5
    const colorHeaderText = [31, 58, 138]; // #1F3A8A
    const colorCellBg = [255, 255, 224];   // #FFFFE0
    const colorGrayBg = [241, 241, 241]; // #f1f1f1

    autoTable(doc, {
      startY: 30,
      theme: 'grid',
      head: [
        [
            { content: 'Cycle Number', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } },
            { content: labelCycleTime, colSpan: 3, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } },
            { content: `Queue at Start of ${isSignalised ? 'RED' : 'WAIT (Gap Search)'}`, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: colorHeaderBg, textColor: colorHeaderText } },
            { content: labelQueueStartGreen, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: colorHeaderBg, textColor: colorHeaderText } },
            { content: 'Back of Queue Count', styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: colorHeaderBg, textColor: colorHeaderText } },
            { content: 'Back of Queue', styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: colorHeaderBg, textColor: colorHeaderText } },
            { content: labelOverflow, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: colorHeaderBg, textColor: colorHeaderText } },
        ],
        [
            { content: 'H', styles: { halign: 'center' } },
            { content: 'M', styles: { halign: 'center' } },
            { content: 'S', styles: { halign: 'center' } },
            { content: '(veh)\nNi', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '(veh)\nNr', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '(veh)\nNg', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '(veh)\nNb', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '(veh)\nNo', styles: { halign: 'center', fontStyle: 'bold' } },
        ]
      ],
      body: [
          ...bodyData,
          ...statsRows
      ],
      headStyles: {
          fillColor: colorHeaderBg,
          textColor: colorHeaderText,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          fontSize: 8
      },
      bodyStyles: {
          fillColor: colorCellBg,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          fontSize: 9,
          halign: 'center'
      },
      columnStyles: {
          0: { fontStyle: 'bold', textColor: colorHeaderText },
          // Stats row formatting handled in didParseCell
      },
      didParseCell: function(data) {
          // Identify stats rows (after the 20 data rows)
          if (data.section === 'body' && data.row.index >= 20) {
              if (data.column.index === 0) {
                  // Label column ("98th percentile", etc)
                  data.cell.styles.halign = 'right';
                  data.cell.colSpan = 4;
                  data.cell.styles.fillColor = colorGrayBg;
                  data.cell.styles.fontStyle: 'bold';
                  data.cell.styles.textColor: colorHeaderText;
              }
              // Gray out empty cells in stats
              if ([1, 2, 3, 4, 6, 8].includes(data.column.index)) {
                  data.cell.styles.fillColor = colorGrayBg; // Greyed out
              }
              if (data.column.index === 0 && data.row.index === 24) {
                   // Average Row specifically
                   data.cell.styles.fontStyle = 'bold';
              }
          }
      }
    });

    doc.save(`sidra_survey_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="w-full overflow-x-auto p-4 bg-white shadow-xl rounded-sm border border-sidra-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-sidra-headerText uppercase tracking-wide">Queue Survey Form</h2>
        <div className="flex space-x-2">
            <button 
                onClick={handleExportCSV}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center"
                disabled={data.length === 0}
            >
                <i className="fas fa-file-csv mr-2"></i> CSV
            </button>
            <button 
                onClick={handleExportPDF}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center"
                disabled={data.length === 0}
            >
                <i className="fas fa-file-pdf mr-2"></i> PDF
            </button>
        </div>
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
            <th colSpan={3} className="border border-sidra-border p-1 font-bold">{labelCycleTime}</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Queue at Start of {isSignalised ? 'RED' : 'WAIT (Gap Search)'}</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">{labelQueueStartGreen}</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Back of Queue Count</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">Back of Queue</th>
            <th className="border border-sidra-border p-1 font-bold bg-sidra-header">{labelOverflow}</th>
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