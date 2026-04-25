/**
 * Applied domain expansion blocks.
 * These blocks intentionally sit beside the existing registry files so the
 * original block catalog remains intact while advanced scientific workflows
 * become first-class palette sections.
 */

const ps = (key, label, val = '', desc = '') => ({ key, label, type: 'string', value: val, default: val, description: desc });
const pn = (key, label, val = 0, min = null, max = null, desc = '') => ({ key, label, type: 'number', value: val, default: val, min, max, description: desc });
const pb = (key, label, val = false, desc = '') => ({ key, label, type: 'bool', value: val, default: val, description: desc });
const pc = (key, label, val = '', desc = '') => ({ key, label, type: 'code', value: val, default: val, description: desc });
const psel = (key, label, opts, val, desc = '') => ({ key, label, type: 'select', options: opts, value: val || opts[0], default: val || opts[0], description: desc });
const aIn = (id = 'dataset', label = 'Dataset / input') => ({ id, dir: 'in', dt: 'any', label });
const aOut = (id = 'dataset', label = 'Result dataset') => ({ id, dir: 'out', dt: 'dataset', label });
const cOut = (id = 'report', label = 'Report') => ({ id, dir: 'out', dt: 'classical', label });
const BYPASS = [pb('bypass', 'Bypass', false), pb('code_override', 'Code override', false), pc('override_code', 'Custom .sq code', '')];

export const EXTRA_DOMAIN_CATEGORIES = {
  domain_molecular: { label: 'Applied - Molecular & Chemistry', color: '#059669', icon: 'MOL' },
  domain_materials: { label: 'Applied - Materials & Energy', color: '#78716C', icon: 'MAT' },
  domain_biomed: { label: 'Applied - Biomedical & Genomics', color: '#DB2777', icon: 'BIO' },
  domain_finance: { label: 'Applied - Finance & Risk', color: '#065F46', icon: 'FIN' },
  domain_optimization: { label: 'Applied - Optimization & Logistics', color: '#B45309', icon: 'OPT' },
  domain_aerospace: { label: 'Applied - Aerospace & Simulation', color: '#475569', icon: 'AERO' },
  domain_security: { label: 'Applied - Quantum Security', color: '#DC2626', icon: 'SEC' },
  domain_qml: { label: 'Applied - Quantum ML & AI', color: '#6D28D9', icon: 'QML' },
  domain_physics: { label: 'Applied - Physics & Quantum Matter', color: '#4338CA', icon: 'PHY' },
  domain_climate: { label: 'Applied - Climate & Environment', color: '#166534', icon: 'CLM' },
  domain_industrial: { label: 'Applied - Industrial Operations', color: '#7C2D12', icon: 'OPS' },
  domain_networks: { label: 'Applied - Networks & Telecom', color: '#0369A1', icon: 'NET' },
};

const DOMAIN_SPECS = [
  ['Molecular Docking', 'domain_molecular', 'Rank ligand poses against protein binding pockets with docking scores and contact checks.', ['AutoDock Vina', 'GNINA CNN scoring', 'Quantum annealed pose search', 'Hybrid ML rescoring'], 'minimize binding free energy'],
  ['Protein Folding', 'domain_molecular', 'Predict fold quality, contact maps, secondary structure confidence, and refinement priority.', ['AlphaFold style inference', 'Rosetta fragment assembly', 'Quantum-inspired contact optimization', 'MD refinement'], 'maximize fold confidence'],
  ['Small Molecule Binding Affinity', 'domain_molecular', 'Estimate DeltaG, Ki/Kd, uncertainty, and lead ranking from structure or descriptors.', ['QSAR ensemble', 'FEP approximation', 'Graph neural network', 'Docking plus MM-GBSA'], 'minimize DeltaG'],
  ['Enzyme-Substrate Kinetics', 'domain_molecular', 'Fit Km, Vmax, kcat, inhibition mode, and catalytic efficiency from assay curves.', ['Michaelis-Menten fit', 'Bayesian kinetic model', 'Lineweaver-Burk robust fit', 'Neural ODE'], 'maximize catalytic efficiency'],
  ['Transition State Search', 'domain_molecular', 'Search reaction transition states and activation barriers with constrained optimization.', ['NEB', 'String method', 'QST2/QST3', 'VQE barrier estimator'], 'minimize activation barrier'],
  ['DFT Optimization', 'domain_molecular', 'Optimize molecular geometry and electronic energy with functional/basis controls.', ['B3LYP/6-31G*', 'PBE0/def2-SVP', 'wB97X-D', 'Quantum VQE preconditioner'], 'minimize total energy'],
  ['Hartree-Fock Method Enhancements', 'domain_molecular', 'Improve SCF convergence, basis selection, and post-HF correction handoff.', ['DIIS', 'SOSCF', 'Density fitting', 'MP2 correction'], 'minimize SCF residual'],
  ['Quantum Chemistry Simulations', 'domain_molecular', 'Map fermionic Hamiltonians and run chemistry estimators on classical or quantum backends.', ['UCCSD VQE', 'QPE', 'ADAPT-VQE', 'Classical exact diagonalization'], 'minimize ground state energy'],
  ['Molecular Mechanics QM/MM Hybridization', 'domain_molecular', 'Partition reactive sites into QM region and bulk environment into MM region.', ['ONIOM', 'Electrostatic embedding', 'Mechanical embedding', 'Adaptive QM/MM'], 'minimize boundary error'],
  ['Solvent-Solute Interaction Modeling', 'domain_molecular', 'Estimate solvation, hydrogen bonding, and dielectric screening effects.', ['PCM/SMD', 'COSMO-RS', 'Explicit solvent MD', '3D-RISM'], 'minimize solvation free energy'],
  ['Excitation Energy Calculations', 'domain_molecular', 'Compute excited states, oscillator strengths, and spectral peaks.', ['TD-DFT', 'EOM-CCSD', 'CIS', 'Quantum phase estimation'], 'match target absorption'],
  ['Non-Covalent Interaction Analysis', 'domain_molecular', 'Measure hydrogen bonds, pi-stacking, dispersion, and NCI surfaces.', ['SAPT', 'NCI index', 'Energy decomposition', 'ML interaction map'], 'maximize stabilizing interaction'],
  ['Metalloenzyme Inhibitor Design', 'domain_molecular', 'Optimize ligands for metal coordination, selectivity, and toxicity constraints.', ['Docking with metal constraints', 'QM cluster model', 'FEP rescoring', 'Generative design'], 'maximize selectivity index'],
  ['Isomerization Pathway Search', 'domain_molecular', 'Explore reaction coordinates and low-barrier isomerization routes.', ['NEB', 'Metadynamics', 'Growing string', 'Quantum tunneling estimate'], 'minimize pathway barrier'],
  ['Catalyst Design for Nitrogen Fixation', 'domain_materials', 'Rank catalysts for N2 adsorption, activation, selectivity, and stability.', ['DFT descriptor screen', 'Microkinetic model', 'Bayesian optimization', 'Quantum chemistry surrogate'], 'maximize ammonia yield'],
  ['Carbon Capture Materials', 'domain_materials', 'Screen MOFs, amines, membranes, and sorbents for CO2 uptake and regeneration energy.', ['GCMC surrogate', 'DFT adsorption energy', 'Multi-objective screening', 'Active learning'], 'maximize CO2 selectivity'],
  ['High-Temperature Superconductors', 'domain_materials', 'Search composition and structure space for high Tc candidates.', ['Graph neural surrogate', 'Eliashberg descriptor', 'Bayesian composition search', 'Quantum many-body proxy'], 'maximize predicted Tc'],
  ['Topological Insulator Discovery', 'domain_materials', 'Classify band topology, spin-orbit signatures, and gap robustness.', ['Band inversion screen', 'Z2 invariant estimator', 'DFT workflow', 'Symmetry indicator'], 'maximize topological gap'],
  ['Nanomaterial Electronic Properties', 'domain_materials', 'Predict band gaps, mobility, density of states, and defect sensitivity.', ['Tight binding', 'DFT surrogate', 'Graphene k-p model', 'GNN property model'], 'match target band gap'],
  ['Polymer Synthesis Modeling', 'domain_materials', 'Model polymerization conditions, molecular weight distribution, and property targets.', ['Kinetic Monte Carlo', 'Reaction network model', 'Bayesian recipe optimization', 'Sequence GNN'], 'maximize target property score'],
  ['Battery Chemistry Lithium-Sulfur', 'domain_materials', 'Optimize cathode, electrolyte, shuttle suppression, and cycle life.', ['Electrochemical surrogate', 'DFT adsorption screen', 'Kinetic model', 'Multi-objective optimizer'], 'maximize energy density'],
  ['Hydrogen Storage Material Design', 'domain_materials', 'Rank hydrides, MOFs, and surfaces for gravimetric/volumetric capacity.', ['Adsorption descriptor screen', 'GCMC surrogate', 'DFT binding energy', 'Pareto optimizer'], 'maximize storage capacity'],
  ['Photovoltaic Efficiency Optimization', 'domain_materials', 'Optimize band gap, stability, carrier lifetime, and manufacturing constraints.', ['Shockley-Queisser proxy', 'Perovskite screen', 'Bayesian optimization', 'Defect-aware ML'], 'maximize PCE'],
  ['Power Grid Load Balancing', 'domain_materials', 'Balance generation, storage, demand response, and reliability constraints.', ['OPF', 'Model predictive control', 'Reinforcement learning', 'Stochastic dispatch'], 'minimize unmet load'],
  ['Renewable Energy Forecasting', 'domain_materials', 'Forecast solar/wind generation and uncertainty over operational horizons.', ['Temporal transformer', 'Gradient boosted forecast', 'Ensemble NWP fusion', 'Quantile regression'], 'minimize forecast error'],
  ['Protein-Protein Interaction Networks', 'domain_biomed', 'Build PPI graphs, score centrality, infer modules, and prioritize targets.', ['Graph clustering', 'Node2Vec', 'GNN link prediction', 'Network propagation'], 'maximize target centrality'],
  ['Allosteric Regulation Modeling', 'domain_biomed', 'Find allosteric sites and estimate ligand-driven conformational shifts.', ['MD covariance network', 'Elastic network model', 'Pocket graph search', 'Free energy proxy'], 'maximize modulation score'],
  ['Antibody-Antigen Binding Dynamics', 'domain_biomed', 'Rank antibody designs by affinity, epitope coverage, and developability.', ['Rosetta interface', 'MD stability proxy', 'Paratope GNN', 'Docking rescoring'], 'maximize neutralization proxy'],
  ['De Novo Protein Design', 'domain_biomed', 'Generate protein scaffolds satisfying fold, function, and stability constraints.', ['Diffusion design', 'RosettaDesign', 'ProteinMPNN', 'Quantum-inspired sequence search'], 'maximize stability and function'],
  ['Viral Capsid Assembly Simulation', 'domain_biomed', 'Model capsid subunit assembly, energetics, defects, and inhibition points.', ['Coarse-grained MD', 'Kinetic assembly model', 'Graph assembly model', 'Monte Carlo'], 'minimize malformed assembly'],
  ['Drug Toxicity Prediction', 'domain_biomed', 'Predict hERG, hepatotoxicity, mutagenicity, and safety liabilities.', ['Tox21 ensemble', 'Graph neural tox model', 'ADMET rules', 'Conformal predictor'], 'minimize toxicity risk'],
  ['In-Silico Clinical Trials', 'domain_biomed', 'Simulate virtual cohorts, endpoints, variability, and trial power.', ['Agent cohort simulation', 'Bayesian trial model', 'PK/PD population model', 'Digital twin'], 'maximize trial power'],
  ['Personalized Genomic Sequencing', 'domain_biomed', 'Prioritize variants, pathways, pharmacogenomic flags, and clinical actionability.', ['Variant annotation', 'Polygenic risk scoring', 'Pathway enrichment', 'Rare variant burden'], 'maximize actionable evidence'],
  ['Metabolomics Pathway Analysis', 'domain_biomed', 'Map metabolites to pathways, enrichment, flux hints, and biomarkers.', ['Pathway enrichment', 'Flux balance proxy', 'Network propagation', 'Bayesian biomarker model'], 'maximize biomarker confidence'],
  ['Pharmacokinetics Modeling', 'domain_biomed', 'Fit absorption, distribution, metabolism, excretion, and exposure metrics.', ['Compartment model', 'PBPK model', 'Population PK', 'Neural ODE'], 'match exposure target'],
  ['Pharmacodynamics Modeling', 'domain_biomed', 'Model dose-response, Emax, EC50, biomarkers, and efficacy windows.', ['Emax model', 'Indirect response', 'PK/PD linked model', 'Bayesian dose response'], 'maximize therapeutic index'],
  ['Blood-Brain Barrier Permeability', 'domain_biomed', 'Predict CNS penetration from chemistry and transporter descriptors.', ['QSAR BBB model', 'Graph neural classifier', 'Rule-based ADMET', 'Uncertainty ensemble'], 'maximize CNS probability'],
  ['Drug Repurposing Screens', 'domain_biomed', 'Rank existing compounds against new targets using signatures and networks.', ['Connectivity Map', 'Knowledge graph ranking', 'Docking screen', 'Multi-omics matching'], 'maximize repurposing score'],
  ['Vaccine Adjuvant Design', 'domain_biomed', 'Optimize adjuvant candidates for immune activation and tolerability.', ['Immune response surrogate', 'Multi-objective screen', 'TLR pathway model', 'Bayesian optimization'], 'maximize immunogenicity'],
  ['CRISPR-Cas9 Target Optimization', 'domain_biomed', 'Design guide RNAs with on-target strength and off-target safety.', ['Azimuth score', 'CFD specificity', 'DeepCRISPR', 'PAM-aware search'], 'maximize specificity'],
  ['Microbiome Functional Analysis', 'domain_biomed', 'Infer microbial pathways, strain functions, dysbiosis, and intervention targets.', ['Metagenomic pathway model', 'Community FBA', 'Differential abundance', 'Graph embedding'], 'maximize functional signal'],
  ['Neurological Pathway Simulation', 'domain_biomed', 'Simulate neural pathways, perturbations, and therapeutic intervention points.', ['Neural mass model', 'Connectome graph', 'ODE pathway model', 'Bayesian network'], 'minimize symptom proxy'],
  ['Cancer Immunotherapy Targeting', 'domain_biomed', 'Prioritize neoantigens, checkpoints, tumor microenvironment targets, and combinations.', ['Neoantigen ranking', 'Immune graph model', 'Survival model', 'Combination optimizer'], 'maximize response probability'],
  ['Post-Translational Modification Modeling', 'domain_biomed', 'Predict phosphorylation, glycosylation, acetylation, and downstream effects.', ['Motif model', 'Kinase network model', 'Protein language model', 'Mass spec fusion'], 'maximize PTM confidence'],
  ['Protein Aggregation Dynamics', 'domain_biomed', 'Model aggregation propensity, nucleation, fibril growth, and inhibitors.', ['Coarse-grained MD', 'Kinetic nucleation model', 'Sequence aggregation score', 'Monte Carlo'], 'minimize aggregation risk'],
  ['Portfolio Optimization', 'domain_finance', 'Optimize asset weights against return, variance, drawdown, and constraints.', ['Mean-variance', 'CVaR optimizer', 'Black-Litterman', 'QAOA portfolio'], 'maximize risk-adjusted return'],
  ['Monte Carlo Option Pricing', 'domain_finance', 'Price derivatives with stochastic paths, Greeks, and confidence intervals.', ['Black-Scholes MC', 'Heston MC', 'Longstaff-Schwartz', 'Quantum amplitude estimation'], 'minimize pricing error'],
  ['Risk Management Scenario Analysis', 'domain_finance', 'Stress portfolios under macro, market, liquidity, and counterparty scenarios.', ['Historical stress', 'Monte Carlo VaR', 'Copula scenario model', 'Bayesian stress tree'], 'minimize tail loss'],
  ['Credit Scoring Models', 'domain_finance', 'Predict default probability with explainability and fairness monitoring.', ['Gradient boosting', 'Logistic scorecard', 'Survival model', 'Explainable ensemble'], 'maximize AUC'],
  ['Fraud Detection Algorithms', 'domain_finance', 'Detect anomalous payments, identity misuse, and graph fraud rings.', ['Graph anomaly detection', 'Isolation forest', 'Autoencoder', 'Rules plus ML'], 'maximize fraud recall'],
  ['Anti-Money Laundering Patterns', 'domain_finance', 'Find structuring, layering, mule networks, and suspicious transaction paths.', ['Transaction graph mining', 'Temporal anomaly model', 'Community detection', 'Rules plus GNN'], 'maximize suspicious pattern score'],
  ['High-Frequency Trading Execution', 'domain_finance', 'Optimize execution schedule, slippage, market impact, and latency.', ['Almgren-Chriss', 'Reinforcement learning', 'Order book simulator', 'MPC execution'], 'minimize implementation shortfall'],
  ['Arbitrage Opportunity Discovery', 'domain_finance', 'Search cross-venue, triangular, statistical, and latency arbitrage candidates.', ['Graph cycle search', 'Cointegration', 'Kalman spread model', 'Quantum annealing'], 'maximize net spread'],
  ['Macroeconomic Forecasting', 'domain_finance', 'Forecast inflation, GDP, rates, and recession probabilities with uncertainty.', ['VAR', 'Dynamic factor model', 'Bayesian structural time series', 'Transformer forecast'], 'minimize forecast error'],
  ['Regulatory Capital Calculations', 'domain_finance', 'Compute capital under Basel, stress, exposure, and risk-weighted assets.', ['Basel standardized', 'IRB model', 'FRTB sensitivities', 'Scenario aggregation'], 'minimize capital breach'],
  ['Insurance Actuarial Risk Modeling', 'domain_finance', 'Estimate claim frequency, severity, reserves, and solvency risk.', ['GLM', 'Credibility model', 'Extreme value theory', 'Bayesian reserving'], 'minimize reserve error'],
  ['Dynamic Asset Allocation', 'domain_finance', 'Rebalance portfolios over horizons with regimes, costs, and risk budgets.', ['MPC allocation', 'Regime switching', 'RL allocation', 'Stochastic programming'], 'maximize utility'],
  ['Traveling Salesman Problem', 'domain_optimization', 'Solve routing tours for cost, distance, and hard constraints.', ['2-opt heuristic', 'Simulated annealing', 'MILP', 'QAOA'], 'minimize route distance'],
  ['Job Shop Scheduling', 'domain_optimization', 'Schedule jobs across machines with precedence and resource constraints.', ['CP-SAT', 'MILP', 'Tabu search', 'Quantum annealing'], 'minimize makespan'],
  ['Supply Chain Route Optimization', 'domain_optimization', 'Optimize multi-echelon routes, inventory handoffs, and service levels.', ['Vehicle routing', 'Network flow', 'Stochastic programming', 'RL dispatch'], 'minimize logistics cost'],
  ['Last-Mile Delivery Logistics', 'domain_optimization', 'Plan delivery routes with time windows, capacity, and driver constraints.', ['VRPTW', 'ALNS', 'Genetic algorithm', 'MPC routing'], 'minimize late deliveries'],
  ['Air Traffic Control Management', 'domain_optimization', 'Resolve conflicts, sequence landings, and allocate corridors safely.', ['Conflict graph coloring', 'MILP sequencing', 'MPC', 'Multi-agent RL'], 'maximize safety margin'],
  ['Paint Shop Sequence Optimization', 'domain_optimization', 'Optimize paint sequencing to reduce color changes and defects.', ['Sequence DP', 'MILP', 'Local search', 'Constraint programming'], 'minimize color changes'],
  ['Robotic Path Planning', 'domain_optimization', 'Plan collision-free robot paths with dynamic obstacles and costs.', ['A*', 'RRT*', 'MPC', 'Reinforcement learning'], 'minimize path cost'],
  ['Fleet Maintenance Scheduling', 'domain_optimization', 'Schedule predictive maintenance with downtime and parts constraints.', ['Survival forecast', 'MILP scheduler', 'Bayesian maintenance', 'RL policy'], 'minimize downtime'],
  ['Port Terminal Logistics', 'domain_optimization', 'Optimize berth allocation, crane scheduling, yard stacking, and truck flows.', ['Berth MILP', 'Crane scheduling', 'Discrete event simulation', 'Digital twin'], 'minimize vessel turnaround'],
  ['Warehouse Layout Design', 'domain_optimization', 'Design slotting, pick paths, aisle layout, and throughput constraints.', ['Facility layout optimizer', 'Pick path simulation', 'Genetic algorithm', 'Queueing model'], 'maximize throughput'],
  ['Satellite Orbit Optimization', 'domain_aerospace', 'Optimize orbit parameters for coverage, fuel, collision risk, and mission goals.', ['Lambert solver', 'Genetic optimizer', 'MPC station keeping', 'Quantum annealing'], 'minimize delta-v'],
  ['Spacecraft Trajectory Planning', 'domain_aerospace', 'Plan multi-body transfers, gravity assists, launch windows, and fuel budgets.', ['Direct collocation', 'Patched conics', 'Low-thrust optimizer', 'RL trajectory'], 'minimize fuel'],
  ['Aerodynamic Flow Simulation CFD', 'domain_aerospace', 'Run or surrogate CFD for lift, drag, pressure fields, and design optimization.', ['RANS surrogate', 'LES coarse model', 'PINN CFD', 'Adjoint optimization'], 'maximize lift-to-drag'],
  ['Rocket Engine Combustion Modeling', 'domain_aerospace', 'Model injector mixing, chamber stability, heat flux, and performance.', ['Chemical equilibrium', 'CFD surrogate', 'Combustion instability model', 'Bayesian calibration'], 'maximize specific impulse'],
  ['Vehicle Crash Test Simulation', 'domain_aerospace', 'Simulate crash energy absorption, injury metrics, and structural constraints.', ['Finite element surrogate', 'DOE response surface', 'Topology optimization', 'Bayesian calibration'], 'minimize injury metric'],
  ['Post-Quantum Cryptography', 'domain_security', 'Select and benchmark lattice/hash/code-based cryptographic schemes.', ['Kyber/KEM analysis', 'Dilithium signatures', 'SPHINCS+', 'Security estimator'], 'maximize security margin'],
  ['Quantum Key Distribution', 'domain_security', 'Model BB84/E91 links, key rate, error rate, and eavesdropper detection.', ['BB84 simulator', 'Decoy state model', 'E91 entanglement', 'Finite-key analysis'], 'maximize secret key rate'],
  ['Quantum Random Number Generation', 'domain_security', 'Estimate entropy, bias, extractor quality, and certification metrics.', ['Beam splitter QRNG', 'Device-independent QRNG', 'NIST test suite', 'Entropy extractor'], 'maximize entropy rate'],
  ['Blind Quantum Computing', 'domain_security', 'Design delegated quantum computation with privacy and verification guarantees.', ['UBQC protocol', 'Trap-based verification', 'Measurement-based QC', 'Client-server protocol'], 'maximize verifiability'],
  ['Secure Multiparty Computation', 'domain_security', 'Build privacy-preserving aggregation, threshold protocols, and leakage checks.', ['Secret sharing', 'Garbled circuits', 'Homomorphic aggregation', 'MPC optimizer'], 'minimize leakage'],
  ['Quantum Digital Signatures', 'domain_security', 'Model signature distribution, verification thresholds, and repudiation bounds.', ['QDS protocol', 'Finite-key bound', 'Multi-recipient verification', 'Security proof proxy'], 'maximize authenticity'],
  ['Quantum Support Vector Machines', 'domain_qml', 'Classify data using quantum kernels, feature maps, and margin estimators.', ['QSVM kernel', 'Pegasos QSVC', 'Classical kernel baseline', 'Hybrid feature map'], 'maximize classification margin'],
  ['Quantum Neural Networks', 'domain_qml', 'Train parameterized quantum circuits for classification or regression.', ['Variational circuit', 'Data re-uploading', 'Hardware-efficient ansatz', 'Quantum natural gradient'], 'minimize loss'],
  ['Quantum Boltzmann Machines', 'domain_qml', 'Model probability distributions with quantum energy-based networks.', ['QBM', 'Restricted Boltzmann proxy', 'Annealed importance sampling', 'Quantum annealer'], 'maximize log likelihood'],
  ['Quantum-Enhanced Feature Selection', 'domain_qml', 'Select feature subsets with quantum or annealing objective functions.', ['QUBO selector', 'QAOA selector', 'Mutual information screen', 'Wrapper search'], 'maximize validation score'],
  ['Quantum Principal Component Analysis', 'domain_qml', 'Estimate dominant components from covariance or density-matrix encodings.', ['QPCA', 'Classical PCA baseline', 'Quantum-inspired SVD', 'Block encoding'], 'maximize explained variance'],
  ['Quantum Clustering Algorithms', 'domain_qml', 'Cluster embeddings with quantum distance estimation or annealing.', ['Quantum k-means', 'QUBO clustering', 'Spectral clustering', 'Hybrid distance kernel'], 'maximize silhouette score'],
  ['Quantum Natural Language Processing', 'domain_qml', 'Encode grammar and text meaning in tensor/quantum circuits.', ['DisCoCat circuit', 'QNLP classifier', 'Tensor network baseline', 'Hybrid embedding'], 'maximize semantic accuracy'],
  ['Quantum Image Recognition QCNN', 'domain_qml', 'Classify images with quantum convolutional or hybrid architectures.', ['QCNN', 'Hybrid CNN-QNN', 'Angle encoding', 'Amplitude encoding'], 'maximize image accuracy'],
  ['Quantum GANs', 'domain_qml', 'Train quantum or hybrid generators and discriminators for synthetic data.', ['QGAN', 'Hybrid GAN', 'Born machine', 'Adversarial circuit'], 'minimize generator loss'],
  ['Reinforcement Learning Optimization', 'domain_qml', 'Optimize policies for control, scheduling, routing, or resource allocation.', ['DQN', 'PPO', 'Hybrid quantum policy', 'Model-based RL'], 'maximize reward'],
  ['Recommender System Engines', 'domain_qml', 'Recommend items with collaborative filtering, graph, and hybrid ranking.', ['Matrix factorization', 'Graph recommender', 'Two-tower model', 'Quantum-inspired ranking'], 'maximize ranking NDCG'],
  ['Lattice Quantum Chromodynamics', 'domain_physics', 'Simulate lattice QCD observables, propagators, and correlation functions.', ['Wilson lattice', 'Hybrid Monte Carlo', 'Tensor network proxy', 'Quantum simulation'], 'minimize observable error'],
  ['Many-Body Localization Studies', 'domain_physics', 'Analyze localization transitions, entanglement growth, and disorder scaling.', ['Exact diagonalization', 'TEBD', 'Random circuit model', 'Quantum simulator'], 'estimate critical disorder'],
  ['Superfluidity Dynamics', 'domain_physics', 'Model vortices, flow, excitations, and critical velocity.', ['Gross-Pitaevskii', 'Bogoliubov modes', 'Path integral MC', 'Hydrodynamic surrogate'], 'maximize phase coherence'],
  ['Bose-Einstein Condensate Simulation', 'domain_physics', 'Simulate condensate wavefunctions, traps, interactions, and dynamics.', ['Gross-Pitaevskii', 'Split-step Fourier', 'Variational ansatz', 'Quantum simulator'], 'minimize energy functional'],
  ['Quantum Phase Transition Modeling', 'domain_physics', 'Estimate critical points, order parameters, and finite-size scaling.', ['DMRG', 'Exact diagonalization', 'VQE ansatz', 'Tensor network'], 'estimate critical point'],
  ['Dark Matter Detection Simulations', 'domain_physics', 'Model detector signals, backgrounds, rates, and discovery confidence.', ['Poisson likelihood', 'Detector response MC', 'Bayesian inference', 'Signal/background classifier'], 'maximize detection significance'],
  ['Nuclear Fusion Plasma Control', 'domain_physics', 'Control plasma shape, instabilities, confinement, and heating.', ['MPC control', 'RL plasma controller', 'MHD surrogate', 'Tokamak digital twin'], 'maximize confinement time'],
  ['Gravitational Wave Signal Processing', 'domain_physics', 'Detect waveform matches, denoise signals, and estimate source parameters.', ['Matched filtering', 'Bayesian parameter estimation', 'Wavelet denoising', 'Neural surrogate'], 'maximize signal-to-noise'],
  ['Photonic Circuit Design', 'domain_physics', 'Design beam splitters, interferometers, waveguides, and integrated photonics.', ['Transfer matrix', 'Adjoint optimization', 'FDTD surrogate', 'Quantum photonic compiler'], 'maximize fidelity'],
  ['Spintronics Material Discovery', 'domain_physics', 'Screen spin Hall angle, magnetic anisotropy, and spin transport properties.', ['DFT descriptor', 'Spin transport surrogate', 'Bayesian materials search', 'Symmetry screen'], 'maximize spin efficiency'],
  ['Graphene Electronic Properties', 'domain_physics', 'Model graphene bands, defects, strain, and device-level response.', ['Tight binding', 'Dirac cone model', 'DFT surrogate', 'Transport model'], 'match mobility target'],
  ['Weather Pattern Prediction', 'domain_climate', 'Forecast weather regimes, extremes, uncertainty, and impact windows.', ['Numerical weather fusion', 'Temporal transformer', 'Analog ensemble', 'Graph neural weather'], 'minimize forecast error'],
  ['Global Climate Modeling', 'domain_climate', 'Model climate scenarios, forcings, feedbacks, and regional outcomes.', ['Earth system surrogate', 'Energy balance model', 'CMIP emulator', 'Physics-informed ML'], 'minimize scenario error'],
  ['Ocean Current Simulation', 'domain_climate', 'Simulate circulation, eddies, transport, and coupling to atmosphere.', ['Shallow water model', 'Ocean GNN', 'Data assimilation', 'Navier-Stokes surrogate'], 'minimize current error'],
  ['Polar Ice Sheet Modeling', 'domain_climate', 'Estimate ice dynamics, melt rates, sea-level contribution, and uncertainty.', ['Ice flow model', 'Basal friction inversion', 'Climate emulator', 'Bayesian calibration'], 'minimize mass-balance error'],
  ['Urban Heat Island Mitigation', 'domain_climate', 'Optimize trees, albedo, shade, ventilation, and cooling interventions.', ['Microclimate simulation', 'GIS optimization', 'Surrogate CFD', 'Multi-objective planning'], 'minimize heat exposure'],
  ['Fertilizer Usage Optimization', 'domain_climate', 'Optimize fertilizer timing, yield, runoff, emissions, and cost.', ['Crop model', 'Bayesian optimization', 'Remote sensing fusion', 'RL prescription'], 'maximize yield per nitrogen'],
  ['Pesticide Molecular Design', 'domain_climate', 'Design molecules for target efficacy, environmental safety, and resistance risk.', ['QSAR pesticide model', 'Docking screen', 'Generative molecule design', 'Multi-objective ADMET'], 'maximize efficacy and safety'],
  ['Spectrum Allocation Optimization', 'domain_networks', 'Allocate spectrum channels under interference and policy constraints.', ['Graph coloring', 'Auction optimizer', 'MILP', 'QUBO allocation'], 'minimize interference'],
  ['5G/6G Signal Beamforming', 'domain_networks', 'Optimize beam weights, coverage, SINR, and energy efficiency.', ['Massive MIMO optimizer', 'RL beam selection', 'Convex beamforming', 'Hybrid analog/digital'], 'maximize SINR'],
  ['Network Traffic Congestion Control', 'domain_networks', 'Control traffic flows, queueing delay, throughput, and reliability.', ['MPC congestion control', 'RL routing', 'Queueing model', 'Graph optimizer'], 'minimize latency'],
];

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function q(value) {
  return JSON.stringify(String(value ?? ''));
}

function mkBlock(spec, index) {
  const [name, cat, info, methods, objective] = spec;
  const meta = EXTRA_DOMAIN_CATEGORIES[cat] || EXTRA_DOMAIN_CATEGORIES.domain_optimization;
  const id = `applied_${slugify(name)}`;
  return {
    id,
    label: name,
    cat,
    color: meta.color,
    icon: meta.icon,
    info: `${info} Produces a ranked, table-shaped result that can feed charts, reports, exports, and downstream optimization blocks.`,
    params: [
      ps('domain_id', 'Domain ID', cat),
      ps('problem_name', 'Problem', name),
      psel('method', 'Method', methods, methods[0]),
      ps('objective', 'Objective', objective),
      ps('input_schema', 'Input schema', 'dataset, constraints, target metrics'),
      pn('sample_size', 'Candidates / samples', 25, 1, 100000),
      pn('confidence_target', 'Confidence target', 0.9, 0, 1),
      ps('output_var', 'Output variable', `result_${index + 1}`),
      ...BYPASS,
    ],
    inputs: [aIn('dataset', 'Dataset'), aIn('constraints', 'Constraints')],
    outputs: [aOut('dataset', 'Ranked results'), cOut('report', 'Summary report'), cOut('score', 'Best score')],
    toSq: p => [
      `let ${p.output_var || `result_${index + 1}`} = applied_solver(problem=${q(name)}, domain=${q(cat)}, method=${q(p.method)}, objective=${q(p.objective)}, samples=${Number(p.sample_size) || 25})`,
      `print(${p.output_var || `result_${index + 1}`})`,
    ].join('\n'),
  };
}

export const EXTRA_DOMAIN_BLOCKS = DOMAIN_SPECS.map(mkBlock);
