import React, { useState, useEffect } from 'react';
import type { SavedScript, ScriptBlock, DisplayCondition, Page, ButtonAction } from '../types.ts';

interface AgentPreviewProps {
  script: SavedScript;
  onClose: () => void;
  embedded?: boolean;
}

const checkCondition = (condition: DisplayCondition | null, values: Record<string, any>): boolean => {
    if (!condition || !condition.blockName) return true;
    const targetValue = values[condition.blockName];
    if (Array.isArray(targetValue)) {
        return targetValue.includes(condition.value);
    }
    return targetValue === condition.value;
};

const AgentPreview: React.FC<AgentPreviewProps> = ({ script, onClose, embedded = false }) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [currentPageId, setCurrentPageId] = useState<string>(script.startPageId);

  const handleValueChange = (name: string, value: any) => {
      setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, option: string, checked: boolean) => {
    setFormValues(prev => {
        const existing: string[] = prev[name] || [];
        if (checked) {
            return { ...prev, [name]: [...existing, option] };
        } else {
            return { ...prev, [name]: existing.filter(item => item !== option) };
        }
    });
  };

  const handleButtonClick = (action: ButtonAction) => {
    switch(action.type) {
        case 'save':
            alert('Données enregistrées (simulation):\n' + JSON.stringify(formValues, null, 2));
            break;
        case 'navigate':
            if (action.pageId) setCurrentPageId(action.pageId);
            break;
        case 'next': {
            const currentIndex = script.pages.findIndex(p => p.id === currentPageId);
            if (currentIndex < script.pages.length - 1) {
                setCurrentPageId(script.pages[currentIndex + 1].id);
            }
            break;
        }
        case 'previous': {
            const currentIndex = script.pages.findIndex(p => p.id === currentPageId);
            if (currentIndex > 0) {
                setCurrentPageId(script.pages[currentIndex - 1].id);
            }
            break;
        }
        default:
            break;
    }
  };

  const renderBlock = (block: ScriptBlock) => {
    const commonContainerProps = {
      style: {
        backgroundColor: block.backgroundColor,
        color: block.textColor,
        fontFamily: block.fontFamily,
        fontSize: block.fontSize ? `${block.fontSize}px` : undefined,
        border: '1px solid #e2e8f0'
      },
      className: "p-3 rounded-md h-full flex flex-col justify-center"
    };

    const commonInputStyles = {
        backgroundColor: block.contentBackgroundColor,
        color: block.contentTextColor
    };

    switch (block.type) {
        case 'label':
            return <div {...commonContainerProps}><p className="font-bold text-lg whitespace-pre-wrap break-words">{block.content.text}</p></div>;
        case 'text':
            return <div {...commonContainerProps}><p className="whitespace-pre-wrap break-words">{block.content.text}</p></div>;
        case 'input':
            return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <input
                        type={block.content.format || 'text'}
                        placeholder={block.content.placeholder}
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    />
                </div>
            );
        case 'radio':
            return (
                <div {...commonContainerProps}>
                    <p className="font-semibold mb-2">{block.content.question}</p>
                    <div className="space-y-1">
                        {block.content.options.map((opt: string) => (
                            <label key={opt} className="flex items-center">
                                <input type="radio" name={block.name} value={opt} onChange={e => handleValueChange(block.name, e.target.value)} className="mr-2" />
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>
            );
        case 'checkbox':
            return (
                <div {...commonContainerProps}>
                    <p className="font-semibold mb-2">{block.content.question}</p>
                    <div className="space-y-1">
                        {block.content.options.map((opt: string) => (
                            <label key={opt} className="flex items-center">
                                <input type="checkbox" name={`${block.name}-${opt}`} value={opt} onChange={e => handleCheckboxChange(block.name, opt, e.target.checked)} className="mr-2" />
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>
            );
        case 'dropdown':
             return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <select
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    >
                        <option value="">-- Sélectionnez --</option>
                        {block.content.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            );
        case 'date':
            return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <input
                        type="date"
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    />
                </div>
            );
        case 'phone':
             return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <input
                        type="tel"
                        placeholder={block.content.placeholder}
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    />
                </div>
            );
        case 'web-view':
            return (
                <div {...commonContainerProps} className="p-0 rounded-md h-full flex flex-col overflow-hidden">
                    <iframe src={block.content.url} className="w-full h-full border-0" title={block.name}></iframe>
                </div>
            );
        case 'email':
            return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <input
                        type="email"
                        placeholder={block.content.placeholder}
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    />
                </div>
            );
        case 'time':
            return (
                <div {...commonContainerProps}>
                    <label className="block font-semibold mb-1">{block.content.label}</label>
                    <input
                        type="time"
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md border-slate-300"
                        onChange={e => handleValueChange(block.name, e.target.value)}
                    />
                </div>
            );
        case 'button':
            return (
                <div {...commonContainerProps} className="p-2 rounded-md h-full flex flex-col justify-center">
                    <button
                        style={commonInputStyles}
                        className="w-full p-2 border rounded-md font-semibold hover:opacity-80 transition-opacity"
                        onClick={() => handleButtonClick(block.content.action)}
                    >
                        {block.content.text}
                    </button>
                </div>
            );
        default:
            return <div {...commonContainerProps}>Type de bloc non supporté: {block.type}</div>
    }
  }
  
  const currentPage = script.pages.find(p => p.id === currentPageId);

  const ScriptCanvas = (
    <div 
      className="h-full rounded-lg p-4 overflow-y-auto relative"
      style={{ backgroundColor: script.backgroundColor }}
    >
      {currentPage?.blocks
          .filter(block => block.type !== 'group' && checkCondition(block.displayCondition, formValues))
          .map(block => (
              <div key={block.id} style={{ position: 'absolute', left: block.x, top: block.y, width: block.width, height: block.height }}>
                  {renderBlock(block)}
              </div>
          ))
      }
    </div>
  );

  if (embedded) {
    // Embedded mode for AgentView
    return (
      <div className="h-full w-full flex flex-col">
        <header className="p-3 border-b border-slate-200 flex-shrink-0">
            <h2 className="text-base font-bold text-slate-800 truncate">{script.name}</h2>
            <p className="text-xs text-slate-500">Page: {currentPage?.name}</p>
        </header>
        <div className="flex-1 overflow-hidden p-2 bg-slate-50">
          {ScriptCanvas}
        </div>
      </div>
    );
  }

  // Modal mode for ScriptBuilder preview
  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Prévisualisation Agent - {script.name}</h2>
            <p className="text-sm text-slate-500">Page Actuelle: {currentPage?.name}</p>
          </div>
          <button onClick={onClose} className="bg-slate-100 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-200">
            Retour à l'éditeur
          </button>
        </header>

        <div className="flex-1 overflow-hidden p-4">
          {ScriptCanvas}
        </div>
      </div>
    </div>
  );
};

export default AgentPreview;