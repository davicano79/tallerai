import React, { useState } from 'react';
import { AppSettings, FirebaseConfig } from '../types';
import { Save, X, Database, AlertCircle, Wifi, Flame, HelpCircle, RefreshCw, Download } from 'lucide-react';
import { syncWithFirebase } from '../services/firebaseService';
import { ToastType } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onShowToast: (msg: string, type: ToastType) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave, onShowToast }) => {
  const [configJson, setConfigJson] = useState<string>(
    settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig, null, 2) : ''
  );
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [detailedError, setDetailedError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getParsedConfig = (): FirebaseConfig | null => {
    if (!configJson.trim()) return null;

    try {
        return JSON.parse(configJson);
    } catch (e) {
        try {
            let fixed = configJson.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ');
            fixed = fixed.replace(/'/g, '"');
            fixed = fixed.replace(/,(\s*})/g, '$1');
            return JSON.parse(fixed);
        } catch (e2) {
            return null;
        }
    }
  };

  const handleTestConnection = async () => {
    const config = getParsedConfig();
    
    if (!config) {
        setTestStatus('error');
        setTestMessage('Formato inválido.');
        setDetailedError('Asegúrate de copiar todo el objeto, incluidas las llaves { y }.');
        return;
    }

    if (!config.apiKey || !config.projectId) {
        setTestStatus('error');
        setTestMessage('Faltan campos requeridos.');
        setDetailedError('El objeto debe contener al menos "apiKey" y "projectId".');
        return;
    }

    setTestStatus('testing');
    setTestMessage('Conectando con Firestore...');
    setDetailedError(null);

    try {
        const tempSettings: AppSettings = { firebaseConfig: config };
        await syncWithFirebase([], tempSettings);
        
        setTestStatus('success');
        setTestMessage('¡Conexión Exitosa con Firebase!');
        onShowToast("Conexión exitosa", "success");
        
        setConfigJson(JSON.stringify(config, null, 2));

    } catch (error: any) {
        setTestStatus('error');
        console.error("Firebase Error:", error);
        
        let msg = "Error desconocido.";
        let detail = error.message || JSON.stringify(error);

        if (JSON.stringify(error).includes("permission-denied") || error.code === "permission-denied") {
            msg = "Permiso Denegado.";
            detail = "Ve a Firebase Console > Firestore > Reglas. Cambia 'allow read, write: if false;' a 'if true;' para modo de prueba.";
        } else if (JSON.stringify(error).includes("not-found") || error.code === "not-found" || error.code === "unimplemented") {
            msg = "Base de datos no encontrada.";
            detail = "Asegúrate de haber hecho clic en 'Crear base de datos' en la sección Firestore de la consola.";
        } else if (error.name === "FirebaseError") {
            msg = "Error de configuración.";
        }

        setTestMessage(msg);
        setDetailedError(detail);
        onShowToast("Error conectando: " + msg, "error");
    }
  };

  const handleSave = async () => {
    const config = getParsedConfig();
    if (!config) {
        onShowToast("El texto introducido no es válido", "error");
        return;
    }

    setLoading(true);
    try {
        onSave({ firebaseConfig: config });
        onClose();
    } catch (error) {
        onShowToast("Error guardando configuración", "error");
    } finally {
        setLoading(false);
    }
  };
  
  const handleImport = async () => {
      const config = getParsedConfig();
      if (!config) {
          onShowToast("Configuración inválida", "error");
          return;
      }
      onShowToast("Importando datos de la nube...", "info");
      // This triggers the sync in App.tsx
      onSave({ firebaseConfig: config }); 
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-orange-600 text-white p-4 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold flex items-center">
            <Database className="mr-2" size={20} />
            Configuración Firebase
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center">
                <Flame size={16} className="mr-1"/> Integración Firestore
            </h3>
            <p className="text-xs text-orange-800 mb-2">
                Copia el objeto <code>firebaseConfig</code> desde la configuración de tu proyecto en Firebase Console.
            </p>
            <div className="flex items-start mt-2 text-xs text-orange-700 bg-orange-100 p-2 rounded">
               <HelpCircle size={14} className="mr-1 mt-0.5 flex-shrink-0"/>
               <span>
                 <strong>Nota:</strong> Puedes pegar el código tal cual te lo da Firebase. El sistema lo corregirá automáticamente.
               </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Pegar Configuración Aquí</label>
            <textarea 
              value={configJson}
              onChange={(e) => {
                  setConfigJson(e.target.value);
                  if (testStatus !== 'idle') setTestStatus('idle');
                  if (detailedError) setDetailedError(null);
              }}
              placeholder={
`const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  ...
};`}
              className="w-full p-3 border border-gray-300 rounded bg-white text-gray-900 text-sm font-mono h-48 focus:ring-2 focus:ring-orange-500 outline-none resize-none shadow-inner placeholder-gray-400"
            />
            
             <div className="mt-2 flex justify-end">
               <button 
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center bg-blue-50 px-3 py-1.5 rounded border border-blue-100 transition-colors"
               >
                   {testStatus === 'testing' ? <RefreshCw className="animate-spin mr-2" size={14}/> : <Wifi size={14} className="mr-2"/>}
                   {testStatus === 'testing' ? 'Verificando...' : 'Probar Conexión'}
               </button>
            </div>
          </div>

          {/* Test Result Area */}
          {testStatus !== 'idle' && (
              <div className={`p-3 rounded text-xs font-bold border animate-fade-in ${
                  testStatus === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 
                  testStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                  'bg-yellow-50 text-yellow-700 border-yellow-200'
              }`}>
                  <div className="flex items-center mb-1">
                      {testStatus === 'error' && <AlertCircle size={16} className="mr-2"/>}
                      {testStatus === 'success' && <Wifi size={16} className="mr-2"/>}
                      <span>{testMessage}</span>
                  </div>
                  {detailedError && (
                      <div className="mt-2 pt-2 border-t border-red-200 font-normal text-red-800">
                          <strong>Solución:</strong> {detailedError}
                      </div>
                  )}
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-4 border-t shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded transition-colors font-medium w-full sm:w-auto"
          >
            Cancelar
          </button>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={handleImport}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded shadow hover:bg-indigo-200 transition-all flex items-center justify-center"
                title="Descargar datos existentes de Firebase"
              >
                <DownloadCloud className="mr-2" size={18} />
                Importar Datos
              </button>

              <button 
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white font-bold rounded shadow hover:bg-orange-700 transition-all flex items-center justify-center"
              >
                {loading ? <RefreshCw className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18} />}
                Guardar y Sincronizar
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
