import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

const SystemSettings = ({ athleteId }) => {
  const [activeTab, setActiveTab] = useState('seo');

  const handleTabChange = (value) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Settings className="w-8 h-8 text-[#00C2A8] mr-3" />
            <h1 className="text-3xl font-display font-bold text-white">System Settings</h1>
          </div>
          <p className="text-gray-300">
            Super Admin Dashboard - Monitor and manage system-wide settings
          </p>
        </div>

        {/* System Settings Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="seo" className="text-xs md:text-sm">
              <span>SEO</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="text-xs md:text-sm">
              <span>Modules</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="text-xs md:text-sm">
              <span>Statistics</span>
            </TabsTrigger>
          </TabsList>

          {/* SEO Tab */}
          <TabsContent value="seo">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">SEO Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure search engine optimization settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-gray-400 text-center py-12">
                  SEO configuration coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">Module Management</CardTitle>
                <CardDescription className="text-gray-400">
                  Enable or disable system modules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-gray-400 text-center py-12">
                  Module configuration coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">System Statistics</CardTitle>
                <CardDescription className="text-gray-400">
                  View system performance and usage statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-gray-400 text-center py-12">
                  Statistics dashboard coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;
