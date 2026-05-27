import { useState, useEffect } from 'react';
import { LayoutGroup } from 'motion/react';
import { Patient } from './components/PatientList';
import HomePage from './HomePage';
import PatientSearch from './flow/PatientSearch';
import CreatePatient from './flow/CreatePatient';
import RestoHome from './flow/RestoHome';
import ScanningSelection from './flow/ScanningSelection';
import NewScan from './flow/NewScan';
import Dentures from './flow/Dentures';
import Appliances from './flow/Appliances';
import Invisalign from './flow/Invisalign';
import ImplantPlanning from './flow/ImplantPlanning';
import IteroHomepage from './components/IteroHomepage';
import PatientDetailsForm from './components/PatientDetailsForm';
import ScanPageMultiLayer from './flow/ScanPageMultiLayer';
import CanvasThemePage from './components/CanvasThemePage';
import FloatingColorPicker from './components/FloatingColorPicker';
import MultiLayerView from './flow/MultiLayerView';
import Summary from './flow/Summary';

// Application entrypoint with full workflow support
type View = 'home' | 'flow' | 'resto' | 'iteroHome' | 'patientDetails' | 'scanGuidance' | 'canvasTheme';
type FlowStep = 'search' | 'create' | 'scanning' | 'newScan' | 'scanMultiLayer' | 'multiLayerView' | 'summary';

// Define scan layer type
export interface ScannedLayer {
  id: string;
  label: string;
  type: "treatment" | "bite" | "pre-treatment" | "additional";
  scannedJaws: {
    upper: boolean;
    lower: boolean;
    bite: boolean;
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [flowStep, setFlowStep] = useState<FlowStep>('search');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedScanType, setSelectedScanType] = useState<string | null>(null);
  const [originalProcedureScanType, setOriginalProcedureScanType] = useState<string | null>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [scannedLayers, setScannedLayers] = useState<ScannedLayer[]>([]);
  const [toothTreatments, setToothTreatments] = useState<{ [tooth: string]: string }>({});
  const [toothSpecifications, setToothSpecifications] = useState<{ [tooth: string]: { [key: string]: string } }>({});
  const [selectedBiteOptions, setSelectedBiteOptions] = useState<string[]>([]);
  const [preTreatmentEnabled, setPreTreatmentEnabled] = useState(false);
  const [canvasBg, setCanvasBg] = useState('#E0EDF4');
  const [isCanvasThemeMode, setIsCanvasThemeMode] = useState(false);

  // Reset everything and go home — canvas always resets to default
  const goHome = () => {
    setCurrentView('home');
    setFlowStep('search');
    setSelectedPatient(null);
    setCanvasBg('#E0EDF4');
    setIsCanvasThemeMode(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'r':
          goHome();
          break;

        case 'escape':
          goHome();
          break;

        case 'arrowleft':
          e.preventDefault();
          if (currentView === 'flow') {
            handleFlowBack();
          } else if (currentView !== 'home') {
            handleBack();
          }
          break;

        case 'arrowright':
          e.preventDefault();
          if (currentView === 'flow' && selectedPatient && flowStep === 'search') {
            setFlowStep('scanning');
          }
          break;

        case '1':
          if (currentView === 'home') {
            setCurrentView('iteroHome');
          }
          break;

        case '2':
          if (currentView === 'home') {
            setCurrentView('flow');
            setFlowStep('search');
            setSelectedPatient(null);
          }
          break;

        case '3':
          if (currentView === 'home') {
            setCurrentView('resto');
          }
          break;

        case 'h':
          goHome();
          break;

        case 's':
          // Quick test: jump to scan page with demo patient and crown workflow
          setCurrentView('flow');
          setFlowStep('scanMultiLayer');
          setSelectedPatient({ id: 'demo', firstName: 'Demo', lastName: 'Patient', dateOfBirth: '1990-01-01', gender: 'male', chartNumber: '12345' });
          setSelectedScanType('crown');
          setToothTreatments({'14': 'Crown'});
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, flowStep, selectedPatient]);

  const handleNavigate = (destination: 'flow' | 'resto' | 'iteroHome' | 'scanGuidance' | 'canvasTheme') => {
    if (destination === 'flow') {
      setCurrentView('iteroHome');
      setSelectedPatient(null);
    } else {
      setCurrentView(destination);
    }
  };

  const handleBack = () => {
    goHome();
  };

  const handleFlowBack = () => {
    if (flowStep === 'newScan') {
      setFlowStep('scanning');
    } else if (flowStep === 'scanning') {
      setFlowStep('search');
    } else if (flowStep === 'create') {
      setFlowStep('search');
    } else {
      // From patient search, go back to iTero Homepage
      setCurrentView('iteroHome');
    }
  };

  const handleNextInFlow = () => {
    if (flowStep === 'search') {
      setFlowStep('scanning');
    } else if (flowStep === 'create') {
      alert('Patient created!');
      setFlowStep('scanning');
    } else if (flowStep === 'scanning') {
      alert('Scan type selected! More flow screens coming soon...');
      goHome();
    } else if (flowStep === 'newScan') {
      alert('New scan created! More flow screens coming soon...');
      goHome();
    } else if (flowStep === 'scanMultiLayer') {
      alert('Multi-layer scan created! More flow screens coming soon...');
      goHome();
    } else if (flowStep === 'multiLayerView') {
      alert('Multi-layer view created! More flow screens coming soon...');
      goHome();
    } else if (flowStep === 'summary') {
      alert('Summary created! More flow screens coming soon...');
      goHome();
    }
  };

  const handleCreateNew = () => {
    setFlowStep('create');
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setFlowStep('scanning');
  };

  const handleProcedureChange = (procedureName: string) => {
    const procedureMap: { [key: string]: string } = {
      "Study model": "studyModel",
      "Invisalign": "invisalign",
      "Fixed restorative": "fixedRestorative",
      "Crown & Bridge": "crown",
      "Crown": "crown",
      "Appliances": "appliances",
      "Dentures": "dentures",
      "Scan for surgical guide": "surgicalGuide",
      "All on X": "allOnX",
      "Implant planning": "implantPlanning",
      "Implant Planning": "implantPlanning",
      "Implant based": "implantPlanning",
      "Implant-based": "implantPlanning",
    };

    const newScanType = procedureMap[procedureName] || "general";
    setSelectedScanType(newScanType);
    setOriginalProcedureScanType(newScanType);
    setSelectedProcedure(procedureName);
  };

  const handleNavigateToMultiLayer = () => {
    if (!selectedPatient) {
      setSelectedPatient({
        id: "default",
        firstName: "Demo",
        lastName: "Patient",
        dateOfBirth: "01/01/1990",
        gender: "female",
        chartNumber: "847392561",
      });
    }
    setCurrentView('flow');
    setFlowStep('scanMultiLayer');
  };

  const handleNavigateToView = () => {
    if (!selectedPatient) {
      setSelectedPatient({
        id: "default",
        firstName: "Demo",
        lastName: "Patient",
        dateOfBirth: "01/01/1990",
        gender: "female",
        chartNumber: "847392561",
      });
    }
    setCurrentView('flow');
    setFlowStep('multiLayerView');
  };

  const handleProcedureEdit = () => {
    setFlowStep('scanning');
    setSelectedScanType(originalProcedureScanType);
  };

  const handleNavigateToSummary = () => {
    if (!selectedPatient) {
      setSelectedPatient({
        id: "default",
        firstName: "Demo",
        lastName: "Patient",
        dateOfBirth: "01/01/1990",
        gender: "female",
        chartNumber: "847392561",
      });
    }
    setCurrentView('flow');
    setFlowStep('summary');
  };

  const handleNavigateToRx = () => {
    if (!selectedPatient) {
      setSelectedPatient({
        id: "default",
        firstName: "Demo",
        lastName: "Patient",
        dateOfBirth: "01/01/1990",
        gender: "female",
        chartNumber: "847392561",
      });
    }
    setCurrentView('flow');
    setFlowStep('newScan');
  };

  // ── Render main content ─────────────────────────────────────────────────────

  let content: React.ReactNode = null;

  if (currentView === 'flow') {
    if (flowStep === 'search') {
      content = (
        <LayoutGroup>
          <PatientSearch
            onBack={handleBack}
            onNext={handleNextInFlow}
            onCreateNew={handleCreateNew}
            onPatientSelect={handlePatientSelect}
            onNavigateToMultiLayer={handleNavigateToMultiLayer}
            onNavigateToView={handleNavigateToView}
          />
        </LayoutGroup>
      );
    } else if (flowStep === 'create') {
      content = (
        <LayoutGroup>
          <CreatePatient onBack={handleFlowBack} onNext={handleNextInFlow} onNavigateToMultiLayer={handleNavigateToMultiLayer} onNavigateToView={handleNavigateToView} />
        </LayoutGroup>
      );
    } else if (flowStep === 'scanning' && selectedPatient) {
      content = (
        <LayoutGroup>
          <ScanningSelection
            onNext={(scanType: string) => {
              setSelectedScanType(scanType);
              setOriginalProcedureScanType(scanType);
              const scanTypeToProcedure: { [key: string]: string } = {
                "studyModel": "Study model",
                "invisalign": "Invisalign",
                "fixed-restorative": "Fixed restorative",
                "fixedRestorative": "Fixed restorative",
                "appliances": "Appliances",
                "dentures": "Dentures",
                "surgicalGuide": "Scan for surgical guide",
                "allOnX": "All on X",
                "implantPlanning": "Implant planning",
              };
              setSelectedProcedure(scanTypeToProcedure[scanType] || scanType);
              setFlowStep('newScan');
            }}
            patient={selectedPatient}
            onNavigateToMultiLayer={handleNavigateToMultiLayer}
          />
        </LayoutGroup>
      );
    } else if (flowStep === 'newScan' && selectedPatient) {
      if (selectedScanType === 'dentures') {
        content = (
          <LayoutGroup>
            <Dentures
              onBack={handleFlowBack}
              onNext={handleNextInFlow}
              patient={selectedPatient}
              scanType={selectedScanType}
              onProcedureChange={handleProcedureChange}
              onNavigateToMultiLayer={handleNavigateToMultiLayer}
              onProcedureEdit={handleProcedureEdit}
              onNavigateToSummary={handleNavigateToSummary}
            />
          </LayoutGroup>
        );
      } else if (selectedScanType === 'appliances') {
        content = (
          <LayoutGroup>
            <Appliances
              onBack={handleFlowBack}
              onNext={handleNextInFlow}
              patient={selectedPatient}
              scanType={selectedScanType}
              onProcedureChange={handleProcedureChange}
              onNavigateToMultiLayer={handleNavigateToMultiLayer}
              onProcedureEdit={handleProcedureEdit}
              onNavigateToSummary={handleNavigateToSummary}
            />
          </LayoutGroup>
        );
      } else if (selectedScanType === 'invisalign') {
        content = (
          <LayoutGroup>
            <Invisalign
              onBack={handleFlowBack}
              onNext={handleNextInFlow}
              patient={selectedPatient}
              scanType={selectedScanType}
              onProcedureChange={handleProcedureChange}
              onNavigateToMultiLayer={handleNavigateToMultiLayer}
              onProcedureEdit={handleProcedureEdit}
            />
          </LayoutGroup>
        );
      } else if (selectedScanType === 'implantPlanning') {
        content = (
          <LayoutGroup>
            <ImplantPlanning
              onBack={handleFlowBack}
              onNext={handleNextInFlow}
              patient={selectedPatient}
              scanType={selectedScanType}
              onProcedureChange={handleProcedureChange}
              onNavigateToMultiLayer={handleNavigateToMultiLayer}
              onProcedureEdit={handleProcedureEdit}
            />
          </LayoutGroup>
        );
      } else {
        content = (
          <LayoutGroup>
            <NewScan
              onBack={handleFlowBack}
              onNext={handleNextInFlow}
              patient={selectedPatient}
              scanType={selectedScanType || ''}
              initialProcedure={selectedProcedure || undefined}
              onProcedureChange={handleProcedureChange}
              onNavigateToMultiLayer={handleNavigateToMultiLayer}
              onNavigateToView={handleNavigateToView}
              onNavigateToSummary={handleNavigateToSummary}
              onProcedureEdit={handleProcedureEdit}
              externalToothTreatments={toothTreatments}
              onToothTreatmentsChange={setToothTreatments}
              externalToothSpecifications={toothSpecifications}
              onToothSpecificationsChange={setToothSpecifications}
              onPreTreatmentToggle={setPreTreatmentEnabled}
            />
          </LayoutGroup>
        );
      }
    } else if (flowStep === 'scanMultiLayer' && selectedPatient) {
      content = (
        <LayoutGroup>
          <ScanPageMultiLayer
            onBack={handleFlowBack}
            onHome={handleBack}
            patient={selectedPatient}
            onNavigateToMultiLayer={handleNavigateToMultiLayer}
            onNavigateToView={handleNavigateToView}
            onNavigateToRx={handleNavigateToRx}
            onNavigateToSummary={handleNavigateToSummary}
            scanType={selectedScanType || ''}
            onScannedLayersChange={setScannedLayers}
            onWorkflowChange={setSelectedScanType}
            onBiteOptionsChange={setSelectedBiteOptions}
            toothTreatments={toothTreatments}
            preTreatmentEnabled={preTreatmentEnabled}
            canvasBg={canvasBg}
            onCanvasBgChange={setCanvasBg}
            isCanvasThemeMode={isCanvasThemeMode}
          />
        </LayoutGroup>
      );
    } else if (flowStep === 'multiLayerView' && selectedPatient) {
      content = (
        <LayoutGroup>
          <MultiLayerView
            onBack={handleFlowBack}
            onHome={handleBack}
            patient={selectedPatient}
            onNavigateToMultiLayer={handleNavigateToMultiLayer}
            onNavigateToView={handleNavigateToView}
            onNavigateToSummary={handleNavigateToSummary}
            onNavigateToRx={handleNavigateToRx}
            scannedLayers={scannedLayers}
            scanType={selectedScanType}
            selectedBiteOptions={selectedBiteOptions}
            canvasBg={canvasBg}
            onCanvasBgChange={setCanvasBg}
          />
        </LayoutGroup>
      );
    } else if (flowStep === 'summary' && selectedPatient) {
      content = (
        <LayoutGroup>
          <Summary
            onBack={handleFlowBack}
            onHome={handleBack}
            patient={selectedPatient}
            onNavigateToMultiLayer={handleNavigateToMultiLayer}
            onNavigateToView={handleNavigateToView}
            onNavigateToRx={handleNavigateToRx}
            scannedLayers={scannedLayers}
            scanType={originalProcedureScanType || selectedScanType}
            procedureToothTreatments={toothTreatments}
            procedureToothSpecifications={toothSpecifications}
          />
        </LayoutGroup>
      );
    }
  } else if (currentView === 'resto') {
    content = (
      <LayoutGroup>
        <RestoHome onBack={handleBack} />
      </LayoutGroup>
    );
  } else if (currentView === 'iteroHome') {
    content = (
      <IteroHomepage
        onNewScan={() => {
          setCurrentView('patientDetails');
        }}
      />
    );
  } else if (currentView === 'scanGuidance') {
    const demoPatient = selectedPatient ?? {
      id: 'demo',
      firstName: 'Demo',
      lastName: 'Patient',
      dateOfBirth: '01/01/1990',
      gender: 'female',
      chartNumber: '000000',
    };
    content = (
      <LayoutGroup>
        <ScanPageMultiLayer
          patient={demoPatient}
          onBack={() => setCurrentView('home')}
          onHome={() => setCurrentView('home')}
          enableScanGuidance={true}
          canvasBg={canvasBg}
          onCanvasBgChange={setCanvasBg}
        />
      </LayoutGroup>
    );
  } else if (currentView === 'canvasTheme') {
    content = (
      <CanvasThemePage
        onBackToHome={goHome}
        onApplyToFlow={(color: string) => {
          setCanvasBg(color);
          setIsCanvasThemeMode(true);
          setCurrentView('iteroHome');
        }}
      />
    );
  } else if (currentView === 'patientDetails') {
    content = (
      <PatientDetailsForm
        onBack={() => {
          setCurrentView('iteroHome');
        }}
        onPatients={() => {
          setCurrentView('flow');
          setFlowStep('search');
          setSelectedPatient(null);
        }}
        onCreatePatient={(patient: Patient) => {
          setSelectedPatient(patient);
          setCurrentView('flow');
          setFlowStep('scanning');
        }}
      />
    );
  } else {
    // home
    content = (
      <LayoutGroup>
        <HomePage onNavigate={handleNavigate} />
      </LayoutGroup>
    );
  }

  return (
    <>
      {content}
      {isCanvasThemeMode && currentView !== 'canvasTheme' && currentView !== 'home' && (
        <FloatingColorPicker
          currentColor={canvasBg}
          onColorChange={setCanvasBg}
        />
      )}
    </>
  );
}
