import React from 'react';
import { SurveySettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SurveySettings;
  onSave: (settings: SurveySettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [tempSettings, setTempSettings] = React.useState<SurveySettings>(settings);

  React.useEffect(() => {
    setTempSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof SurveySettings, value: string) => {
    const numVal = parseFloat(value);
    setTempSettings(prev => ({
      ...prev,
      [key]: isNaN(numVal) ? 0 : numVal
    }));
  };

  const handleSave = () => {
    onSave(tempSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold text-gray-800">Detection Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Detection Confidence Threshold (0.1 - 1.0)
            </label>
            <input 
              type="number" step="0.05" min="0.1" max="1.0"
              value={tempSettings.detectionConfidence}
              onChange={(e) => handleChange('detectionConfidence', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Lower this to detect smaller vehicles (motorcycles). Too low adds noise.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Stop Speed Threshold (px/frame)
            </label>
            <input 
              type="number" step="0.1" min="0"
              value={tempSettings.stopSpeedThreshold}
              onChange={(e) => handleChange('stopSpeedThreshold', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Vehicles moving slower than this are considered "Stopped".</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Queue Join Threshold (px/frame)
            </label>
            <input 
              type="number" step="0.1" min="0"
              value={tempSettings.queueJoinThreshold}
              onChange={(e) => handleChange('queueJoinThreshold', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Vehicles slower than this are considered to have joined the queue (includes rolling stops).</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tracking Persistence (Frames)
            </label>
            <input 
              type="number" step="1" min="1"
              value={tempSettings.maxMissingFrames}
              onChange={(e) => handleChange('maxMissingFrames', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">How long to keep a vehicle in memory if detection is lost momentarily.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};