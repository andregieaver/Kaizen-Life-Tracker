import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, GripVertical, Trash2, Save, Menu as MenuIcon, Languages } from 'lucide-react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import { StrictModeDroppable } from '../utils/StrictModeDroppable';
import IconPicker from './IconPicker';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MenuEditor = ({ athleteId, onBack }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState(null); // { menuType, itemId }
  const [menus, setMenus] = useState({
    header_logged_out: [],
    header_logged_in: [],
    slideout_menu: [],
    slideout_menu_logged_out: []
  });

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/menus?athlete_id=${athleteId}`);
      setMenus(response.data);
    } catch (error) {
      logger.error(null, 'Error loading menus:', error);
      alert(t('menus.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/menus?athlete_id=${athleteId}`, menus);
      
      // Dispatch custom event to notify Dashboard to reload menus
      window.dispatchEvent(new CustomEvent('menusUpdated'));
      
      alert(t('menus.saveSuccess'));
    } catch (error) {
      logger.error(null, 'Error saving menus:', error);
      alert(t('menus.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!confirm(t('menus.translateAllConfirm'))) {
      return;
    }
    
    try {
      setTranslating(true);
      const response = await axios.post(`${API}/system/translate-menus?athlete_id=${athleteId}`);
      
      // Update menus with translations
      setMenus(response.data.menus);
      
      // Dispatch custom event to notify Dashboard to reload menus
      window.dispatchEvent(new CustomEvent('menusUpdated'));
      
      alert(t('menus.translateSuccess', { count: response.data.translated_count, languages: response.data.languages.join(', ') }));
    } catch (error) {
      logger.error(null, 'Error translating menus:', error);
      const errorMsg = error.response?.data?.detail || t('menus.translateFailed');
      alert(errorMsg);
    } finally {
      setTranslating(false);
    }
  };

  const handleFixLanguage = async () => {
    if (!confirm(t('menus.fixLanguageConfirm'))) {
      return;
    }
    
    try {
      const response = await axios.post(`${API}/system/fix-language?athlete_id=${athleteId}`);
      
      alert(t('menus.fixLanguageSuccess', { message: response.data.message, old: response.data.old_language, new: response.data.new_language }));
      
      // Give user time to read message before auto-refresh
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error fixing language:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to fix language';
      alert(errorMsg);
    }
  };

  const handleTranslateItem = async (menuType, itemId, itemLabel) => {
    if (!confirm(t('menus.translateItemConfirm', { label: itemLabel }))) {
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/system/translate-menu-item?athlete_id=${athleteId}&menu_type=${menuType}&item_id=${itemId}`
      );
      
      // Show translation results
      const languages = response.data.languages.join(', ');
      alert(t('menus.translateItemSuccess', { label: itemLabel, languages, translations: JSON.stringify(response.data.translations, null, 2) }));
      
      // Reload menus to show updated translations
      await loadMenus();
    } catch (error) {
      logger.error(null, 'Error translating item:', error);
      const errorMsg = error.response?.data?.detail || t('menus.translateItemFailed');
      alert(errorMsg);
    }
  };

  const addMenuItem = (menuType) => {
    const newItem = {
      id: `item-${Date.now()}`,
      label: 'New Item',
      url: '/',
      order: menus[menuType].length,
      is_separator: false,
      icon: menuType === 'slideout_menu' ? 'Circle' : undefined
    };
    setMenus(prev => ({
      ...prev,
      [menuType]: [...prev[menuType], newItem]
    }));
  };

  const addSeparator = (menuType) => {
    const newItem = {
      id: `separator-${Date.now()}`,
      label: '',
      url: '',
      order: menus[menuType].length,
      is_separator: true
    };
    setMenus(prev => ({
      ...prev,
      [menuType]: [...prev[menuType], newItem]
    }));
  };

  const removeMenuItem = (menuType, itemId) => {
    setMenus(prev => ({
      ...prev,
      [menuType]: prev[menuType].filter(item => item.id !== itemId)
    }));
  };

  const updateMenuItem = (menuType, itemId, field, value) => {
    setMenus(prev => ({
      ...prev,
      [menuType]: prev[menuType].map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));
  };

  const openIconPicker = (menuType, itemId) => {
    setIconPickerTarget({ menuType, itemId });
    setIconPickerOpen(true);
  };

  const handleIconSelect = (iconName) => {
    if (iconPickerTarget) {
      updateMenuItem(iconPickerTarget.menuType, iconPickerTarget.itemId, 'icon', iconName);
    }
  };

  const handleDragEnd = (menuType, result) => {
    if (!result.destination) return;

    const items = Array.from(menus[menuType]);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order field
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));

    setMenus(prev => ({
      ...prev,
      [menuType]: updatedItems
    }));
  };

  const renderMenuSection = (title, menuType, description) => {
    const items = menus[menuType] || [];
    const isSlideout = menuType === 'slideout_menu' || menuType === 'slideout_menu_logged_out';

    return (
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MenuIcon className="w-5 h-5 text-[#32D3FF]" />
              {title}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSlideout && (
              <button
                type="button"
                onClick={addSeparator}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('menus.addSeparator')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => addMenuItem(menuType)}
              className="flex items-center justify-center gap-2 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('menus.addMenuItem')}</span>
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-400">{t('menus.noMenuItems')}</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={(result) => handleDragEnd(menuType, result)}>
            <StrictModeDroppable droppableId={`menu-${menuType}`} direction="vertical">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-gray-900 border rounded-lg transition-shadow ${
                            snapshot.isDragging ? 'border-[#32D3FF] shadow-lg' : 'border-gray-700'
                          }`}
                        >
                          {item.is_separator ? (
                            // Separator Item
                            <div className="flex items-center justify-between p-4">
                              <div className="flex items-center gap-3 flex-1">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="flex-1 border-t-2 border-gray-600" />
                                <span className="text-xs text-gray-500 uppercase">{t('menus.separator')}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMenuItem(menuType, item.id)}
                                className="text-red-400 hover:text-red-300 transition-colors ml-4"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            // Regular Menu Item
                            <div className="flex items-center gap-3 p-4">
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-5 h-5 text-gray-400" />
                              </div>
                              
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">{t('menus.label')}</label>
                                  <input
                                    type="text"
                                    value={item.label}
                                    onChange={(e) => updateMenuItem(menuType, item.id, 'label', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#32D3FF]"
                                    placeholder={t('menus.menuLabelPlaceholder')}
                                  />
                                </div>
                                
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">{t('menus.url')}</label>
                                  <input
                                    type="text"
                                    value={item.url}
                                    onChange={(e) => updateMenuItem(menuType, item.id, 'url', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#32D3FF]"
                                    placeholder={t('menus.urlPlaceholder')}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">{t('menus.icon')}</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={item.icon || ''}
                                      onChange={(e) => updateMenuItem(menuType, item.id, 'icon', e.target.value)}
                                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#32D3FF]"
                                      placeholder={t('menus.iconPlaceholder')}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => openIconPicker(menuType, item.id)}
                                      className="px-3 py-2 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white rounded text-sm transition-colors whitespace-nowrap"
                                      title={t('menus.chooseIconTitle')}
                                    >
                                      <span className="hidden sm:inline">{t('menus.pickIcon')}</span>
                                      <span className="sm:hidden">🎨</span>
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">{t('menus.highlight')}</label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateMenuItem(menuType, item.id, 'highlighted', !item.highlighted)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        item.highlighted ? 'bg-[#32D3FF]' : 'bg-gray-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          item.highlighted ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                    {item.highlighted && (
                                      <input
                                        type="color"
                                        value={item.highlight_color || '#32D3FF'}
                                        onChange={(e) => updateMenuItem(menuType, item.id, 'highlight_color', e.target.value)}
                                        className="w-8 h-8 rounded border border-gray-700 cursor-pointer"
                                        title={t('menus.chooseHighlightColor')}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTranslateItem(menuType, item.id, item.label)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                  title={t('menus.translateItem')}
                                >
                                  <Languages className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeMenuItem(menuType, item.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </StrictModeDroppable>
          </DragDropContext>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#32D3FF] mx-auto mb-4"></div>
          <p className="text-gray-400">{t('menus.loadingMenus')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('menus.backToAccount')}
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('menus.title')}</h1>
              <p className="text-gray-400 mt-1 text-sm">
                {t('menus.description')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFixLanguage}
                className="bg-orange-500 hover:bg-orange-600 text-white p-3 sm:px-6 sm:py-3 rounded-full sm:rounded-lg flex items-center justify-center gap-2 transition-colors"
                title="TEMPORARY DEBUG: Click to fix Norwegian language"
              >
                <Languages className="w-5 h-5" />
                <span className="hidden sm:inline">{t('menus.fixLanguage')}</span>
              </button>
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white p-3 sm:px-6 sm:py-3 rounded-full sm:rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Languages className="w-5 h-5" />
                <span className="hidden sm:inline">{translating ? t('menus.translating') : t('menus.translateAll')}</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white p-3 sm:px-6 sm:py-3 rounded-full sm:rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                <span className="hidden sm:inline">{saving ? t('menus.saving') : t('menus.saveMenus')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        {renderMenuSection(
          t('menus.headerLoggedOut'),
          'header_logged_out',
          t('menus.headerLoggedOutDesc')
        )}

        {renderMenuSection(
          t('menus.headerLoggedIn'),
          'header_logged_in',
          t('menus.headerLoggedInDesc')
        )}

        {renderMenuSection(
          t('menus.slideoutMenu'),
          'slideout_menu',
          t('menus.slideoutMenuDesc')
        )}

        {renderMenuSection(
          t('menus.slideoutMenuLoggedOut'),
          'slideout_menu_logged_out',
          t('menus.slideoutMenuLoggedOutDesc')
        )}
      </div>

      {/* Icon Picker Modal */}
      <IconPicker
        isOpen={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={handleIconSelect}
        currentIcon={
          iconPickerTarget 
            ? menus[iconPickerTarget.menuType]?.find(item => item.id === iconPickerTarget.itemId)?.icon 
            : null
        }
      />
    </div>
  );
};

export default MenuEditor;
