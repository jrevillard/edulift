import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Settings } from 'lucide-react';
import type { UserGroup } from '../services/apiService';

interface GroupCardProps {
  group: UserGroup;
  onSelect: (groupId: string) => void;
  onManage: (groupId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onSelect, onManage }) => {
  const isAdmin = group.userRole === 'ADMIN';

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid="GroupCard-Card-groupCard">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold" data-testid="GroupCard-Heading-groupName">{group.name}</h3>
            <div className="flex items-center gap-3">
              <Badge variant={isAdmin ? "default" : "secondary"} data-testid="GroupCard-Badge-groupRole">
                {group.userRole}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="GroupCard-Text-familyCount">
                <Users className="h-4 w-4" />
                {group.familyCount} famil{group.familyCount !== 1 ? 'ies' : 'y'}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid="GroupCard-Text-groupOwner">
          Owner: {group.ownerFamily.name}
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(group.id)}
            className="flex-1"
            data-testid="GroupCard-Button-viewSchedule"
          >
            View Schedule
          </Button>
          
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onManage(group.id)}
              className="gap-1"
              data-testid="GroupCard-Button-manageGroup"
            >
              <Settings className="h-4 w-4" />
              Manage
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupCard;