import React from 'react';
import { Button } from './app/components/ui/button';
export function Test() {
  const [selectedEmployee] = React.useState<any>(null);
  const handleCreateEmployee = async () => {
    try {
      await Promise.resolve({
        employeeNumber: `EMP${Date.now().toString().slice(-6)}`,
      });
    } catch (error) {
      console.log(error);
    }
  };
  const handleUpdateEmployee = async () => { console.log('u'); };
  return <Button onClick={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee}>x</Button>;
}
