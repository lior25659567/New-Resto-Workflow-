  <div className="flex flex-col h-screen w-full bg-[#E0EDF4] relative">
      {/* Workflow Selector - Bottom Left Corner */}
      <div className="absolute bottom-[16px] left-[16px] z-[60]">
        <div className="flex flex-row items-center gap-[8px] bg-white rounded-[8px] p-[12px] shadow-lg">
          <button
            onClick={() => {
              setWorkflow("crown");
              onWorkflowChange?.("crown");
            }}
            className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${
              workflow === "crown"
                ? 'bg-[#009ace] text-white'
                : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'
            }`}
            style={{ fontFamily: "'Roboto', sans-serif" }}
          >
            Crown
          </button>
          <button
            onClick={() => {
              setWorkflow("implant-based");
              onWorkflowChange?.("implantPlanning");
            }}
            className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${
              workflow === "implant-based"
                ? 'bg-[#009ace] text-white'
                : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'
            }`}
            style={{ fontFamily: "'Roboto', sans-serif" }}
          >
            Implant based
          </button>
          <button
            onClick={() => {
              setWorkflow("dentures");
              onWorkflowChange?.("dentures");
            }}
            className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${
              workflow === "dentures"
                ? 'bg-[#009ace] text-white'
                : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'
            }`}
            style={{ fontFamily: "'Roboto', sans-serif" }}
          >
            Dentures
          </button>
          <button
            onClick={() => {
              setWorkflow("fixed-restorative");
              onWorkflowChange?.("fixed-restorative");
            }}
            className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${
              workflow === "fixed-restorative"
                ? 'bg-[#009ace] text-white'
                : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'
            }`}
            style={{ fontFamily: "'Roboto', sans-serif" }}
          >
            Multi bite
          </button>
        </div>
      </div>

      <Header 
        activeSteps={{ stepIcon: true }}
        onStepToggle={(step) => {
          if (step === 'search') {
            onBack();
          }
        }}
        onNavigateToScan={onNavigateToMultiLayer}
        onNavigateToView={onNavigateToView}
      />