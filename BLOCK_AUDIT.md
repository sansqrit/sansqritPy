# Sanskrit block audit

- Total blocks: 529
- Categories: 42

## Counts by category
- quantum_gate: 50
- quantum_algo: 32
- ml: 27
- chemistry: 25
- genai: 24
- biology: 23
- physics: 20
- utility: 18
- optimization: 18
- math: 17
- api: 16
- output: 16
- nlp: 16
- transform: 15
- quantum_ec: 15
- cv: 15
- noise: 14
- finance: 14
- quantum_meas: 13
- climate: 12
- robotics: 12
- variable: 10
- drug: 8
- file_src: 8
- logging: 8
- classical: 7
- string_re: 7
- vaccine: 6
- error_mit: 5
- pulse: 5
- benchmark: 5
- materials: 5
- astro: 5
- database: 5
- exec_ctrl: 5
- hardware: 5
- sharding: 4
- fn_block: 4
- medical: 4
- cloud: 4
- security: 4
- quantum_reg: 3

## Sources / transforms / sinks
### Source (110)
q_register, ancilla_reg, classical_reg, grover_block, shor_block, qrng_block, bv_block, dj_block, qwalk_block, xeb_block, rb_block, qvol_block, bin_loader, lambda_block, global_var, local_var, const_var, env_var, secret_var, linspace_block, molecule_init, dna_seq, proteomics_block, dicom_load, ehr_load, hamiltonian_block, ising_model, quantum_field, condensed_matter, crystal_structure, battery_sim, nbody_sim, stellar_evolution, grav_wave, cosmology_block, exoplanet_block, mcp_server, csv_reader, json_reader, xml_reader, parquet_reader, excel_reader, hdf5_reader, pdb_reader, file_watcher, db_connect, http_get, graphql_block, oauth2_block, timer_block, uuid_block, config_load, version_block, surface_code, color_code, magic_state_distill, fault_tolerant_prep, qec_threshold, resource_estimate, concatenated_code, maxcut_block, tsp_block, cvx_opt, img_load, video_process, option_pricing, fx_model, heston_model, order_book, crypto_block, climate_model, co2_model, ocean_model, solar_irradiance, glacier_model, rl_agent, vqd_block, quantum_walk_search, quantum_ldpc, variational_gibbs, mbl_sim, device_noise, snp_analysis, epigenomics_block, metagenomics_block, flow_cytometry, cryo_em_block, haplotype_block, structural_variation, genome_assembly, pinn_block, plasma_sim, nuclear_physics, quantum_optics, spin_boson, qed_calc, quantum_transport, semiclassical_approx, ode_solver, pde_solver, root_finding, numerical_integration, random_numbers, sftp_block, arxiv_fetch, pubmed_fetch, feature_store, env_detect, list_comprehension, dict_comprehension

### Transform (400)
h_gate, x_gate, y_gate, z_gate, s_gate, sdg_gate, t_gate, tdg_gate, sx_gate, rx_gate, ry_gate, rz_gate, phase_gate, u3_gate, cnot_gate, cz_gate, cy_gate, swap_gate, iswap_gate, cp_gate, crz_gate, rzz_gate, ms_gate, ecr_gate, toffoli_gate, fredkin_gate, barrier_gate, reset_gate, delay_gate, custom_unitary, measure_single, measure_all, expectation_val, statevector_block, probabilities_block, qft_block, vqe_block, qaoa_block, qpe_block, hhl_block, qsvm_block, teleport_block, amp_est_block, zne_block, pec_block, twirl_block, symmetry_verify, cdr_block, depol_noise, bitflip_noise, phaseflip_noise, ampdamp_noise, thermal_noise, readout_noise, crosstalk_noise, kraus_noise, gaussian_pulse, drag_pulse, square_pulse, pulse_schedule, ecr_pulse, proc_tomo, state_tomo, shard_register, amp_cache, cross_shard_gate, for_loop, while_loop, if_else, try_catch, fn_def, fn_call, async_fn, var_snapshot, string_ops, regex_ops, json_ops, xml_ops, hash_block, format_string, base64_block, math_ops, matrix_ops, fft_block, stats_block, complex_ops, bit_ops, vqe_chemistry, hartree_fock, mp2_block, ccsd_t_block, dft_block, tanimoto_block, spectroscopy_block, pka_block, logp_block, reaction_path, molecular_docking, admet_block, virtual_screen, qsar_model, lead_opt, de_novo_design, toxicity_block, binding_free_energy, antigen_design, epitope_pred, immunogenicity, antibody_design, mrna_design, vax_formulation, protein_fold, blast_block, rna_fold, gene_expression, crispr_design, seq_align, phylogenetics, img_segment, radio_classify, monte_carlo, molecular_dynamics, band_structure, phonon_block, superconductor_block, train_model, neural_net, predict_block, clustering_block, dimensionality_red, feature_eng, model_eval, openai_block, anthropic_block, gemini_block, ollama_block, mcp_tool_call, llm_router, embeddings_block, rag_block, agent_block, sql_query, nosql_query, vector_db, db_write, s3_block, gcs_block, azure_blob, hdfs_block, http_post, webhook_block, kafka_block, email_block, filter_block, map_transform, sort_block, groupby_block, join_block, pivot_block, schema_validate, plot_block, save_file, circuit_diagram, parallel_exec, rate_limiter, retry_block, checkpoint_block, scheduler_block, profiler_block, jwt_block, encrypt_block, api_key_auth, qasm_export, cirq_export, ibm_runtime, braket_submit, quil_export, sleep_block, note_block, type_cast, debug_break, steane_code, shor_code, bit_flip_code, syndrome_measure, error_correct, logical_gate, decoder_mwpm, stabilizer_sim, cobyla_opt, spsa_opt, adam_opt, genetic_algo, simulated_annealing, pso_opt, lbfgs_opt, bayesian_opt, portfolio_opt, linear_prog, integer_prog ...

### Sink (19)
return_block, break_block, continue_block, print_block, table_block, vqe_dashboard, logger_block, metric_block, assert_block, interactive_dash, bloch_sphere, histogram_plot, heatmap_plot, mol_visualise, console_log_block, latex_output, prometheus_push, structured_log, alert_block
