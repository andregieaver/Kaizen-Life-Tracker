import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Download, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

const WaitingListTab = ({
  waitingListEntries,
  isLoading,
  filter,
  onFilterChange,
  onExport,
  onUpdateStatus,
  onDeleteEntry
}) => {
  const { t } = useTranslation();

  return (
    <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader className="flex flex-col gap-4">
        <div>
          <CardTitle className="text-white text-lg sm:text-xl flex items-center">
            <Mail className="w-5 h-5 mr-2 text-[#32D3FF]" />
            {t('systemSettings.waitingList.entries')}
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm mt-1">
            {t('systemSettings.waitingList.description')}
          </CardDescription>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => onFilterChange('all')}
              className={filter === 'all' ? 'bg-[#32D3FF]' : 'text-gray-300 border-gray-600'}
            >
              {t('systemSettings.waitingList.all')}
            </Button>
            <Button
              size="sm"
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => onFilterChange('pending')}
              className={filter === 'pending' ? 'bg-[#32D3FF]' : 'text-gray-300 border-gray-600'}
            >
              {t('systemSettings.waitingList.pending')}
            </Button>
            <Button
              size="sm"
              variant={filter === 'contacted' ? 'default' : 'outline'}
              onClick={() => onFilterChange('contacted')}
              className={filter === 'contacted' ? 'bg-[#32D3FF]' : 'text-gray-300 border-gray-600'}
            >
              {t('systemSettings.waitingList.contacted')}
            </Button>
            <Button
              size="sm"
              variant={filter === 'converted' ? 'default' : 'outline'}
              onClick={() => onFilterChange('converted')}
              className={filter === 'converted' ? 'bg-[#32D3FF]' : 'text-gray-300 border-gray-600'}
            >
              {t('systemSettings.waitingList.converted')}
            </Button>
          </div>
          
          <Button
            onClick={onExport}
            disabled={waitingListEntries.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto sm:ml-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('systemSettings.waitingList.exportCSV')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            {t('systemSettings.waitingList.loadingEntries')}
          </div>
        ) : waitingListEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {t('systemSettings.waitingList.noEntries')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">
                    {t('systemSettings.waitingList.name')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">
                    {t('systemSettings.waitingList.email')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden md:table-cell">
                    {t('systemSettings.waitingList.nationality')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">
                    {t('systemSettings.waitingList.source')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">
                    {t('systemSettings.waitingList.status')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">
                    {t('systemSettings.waitingList.created')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">
                    {t('systemSettings.waitingList.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {waitingListEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-white text-sm">{entry.name}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{entry.email}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">{entry.nationality}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{entry.source}</td>
                    <td className="px-4 py-3">
                      <select
                        value={entry.status}
                        onChange={(e) => onUpdateStatus(entry.id, e.target.value)}
                        className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
                      >
                        <option value="pending">{t('systemSettings.waitingList.pending')}</option>
                        <option value="contacted">{t('systemSettings.waitingList.contacted')}</option>
                        <option value="converted">{t('systemSettings.waitingList.converted')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDeleteEntry(entry.id)}
                        className="text-red-400 border-red-600 hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WaitingListTab;
