import { Component } from '@angular/core';

import { NotificationsService } from 'app/common/services/notifications/notifications.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AgentPolicy } from 'app/common/interfaces/orb/agent.policy.interface';
import { AgentPoliciesService } from 'app/common/services/agents/agent.policies.service';
import { PolicyTap } from 'app/common/interfaces/orb/policy/policy.tap.interface';

const CONFIG = {
  TAPS: 'TAPS',
  BACKEND: 'BACKEND',
  INPUTS: 'INPUTS',
  HANDLERS: 'HANDLERS',
  AGENT_POLICY: 'AGENT_POLICY',
};

@Component({
  selector: 'ngx-agent-policy-add-component',
  templateUrl: './agent.policy.add.component.html',
  styleUrls: ['./agent.policy.add.component.scss'],
})
export class AgentPolicyAddComponent {
  // #forms
  // agent policy general information - name, desc, backend
  detailsFormGroup: FormGroup;

  // selected tap, input_type
  tapFormGroup: FormGroup;

  // dynamic input config
  inputFormGroup: FormGroup;

  // handlers
  handlerSelectorFormGroup: FormGroup;

  dynamicHandlerConfigFormGroup: FormGroup;

  // #key inputs holders
  // selected backend object
  backend: { [propName: string]: any };

  // selected tap object
  tap: PolicyTap;

  // selected input object
  input: { [propName: string]: any };

  // holds selected handler conf.
  // handler template currently selected, to be edited by user and then added to the handlers list or discarded
  liveHandler: { [propName: string]: any };

  // holds all handlers added by user
  handlers: { name: string, type: string, config: { [propName: string]: {} | any } }[] = [];

  // hold handler selected config
  selected_handler_config: any;

  // #services responses
  // hold info retrieved
  availableBackends: { [propName: string]: { backend: string, description: string } };

  availableTaps: { [propName: string]: PolicyTap };

  availableInputs: { [propName: string]: any };

  availableHandlers: { [propName: string]: any };

  // #if edit
  agentPolicy: AgentPolicy;

  agentPolicyID: string;

  isEdit: boolean;

  // #load controls
  isLoading = Object.entries(CONFIG).reduce((acc, [value]) => {
    acc[value] = false;
    return acc;
  }, {});

  constructor(
    private agentPoliciesService: AgentPoliciesService,
    private notificationsService: NotificationsService,
    private router: Router,
    private route: ActivatedRoute,
    private _formBuilder: FormBuilder,
  ) {
    this.agentPolicy = this.router.getCurrentNavigation().extras.state?.agentPolicy as AgentPolicy || null;
    this.agentPolicyID = this.route.snapshot.paramMap.get('id');
    this.agentPolicy = this.route.snapshot.paramMap.get('agentPolicy') as AgentPolicy;

    this.isEdit = !!this.agentPolicyID;
    this.isLoading[CONFIG.AGENT_POLICY] = this.isEdit;
    !!this.agentPolicyID && agentPoliciesService.getAgentPolicyById(this.agentPolicyID).subscribe(resp => {
      this.agentPolicy = resp;
      this.isLoading[CONFIG.AGENT_POLICY] = false;
      this.readyForms();
    });

    this.readyForms();
  }

  readyForms() {
    const { name, description, backend } = this.agentPolicy
      = {
      name: '',
      description: '',
      backend: 'pktvisor',
      tags: {},
      version: 1,
      policy: {
        kind: 'collection',
        input: {
          config: {},
          tap: '',
          input_type: '',
        },
      },
      handlers: {
        modules: {},
        config: {},
      },
      ...this.agentPolicy,
    };

    this.handlers = Object.entries(this.agentPolicy.handlers.modules)
      .map(([key, handler]) => ({ ...handler, name: key, type: handler.config.type }));

    this.detailsFormGroup = this._formBuilder.group({
      name: [name, [Validators.required, Validators.pattern('^[a-zA-Z_][a-zA-Z0-9_-]*$')]],
      description: [description],
      backend: [{ value: backend, disabled: backend !== '' }, [Validators.required]],
    });
    this.tapFormGroup = this._formBuilder.group({
      'selected_tap': ['', Validators.required],
      'input_type': ['', Validators.required],
    });

    this.handlerSelectorFormGroup = this._formBuilder.group({ 'selected_handler': [''] });
    this.dynamicHandlerConfigFormGroup = this._formBuilder.group({});

    this.getBackendsList();
  }

  getBackendsList() {
    this.isLoading[CONFIG.BACKEND] = true;
    this.agentPoliciesService.getAvailableBackends().subscribe(backends => {
      this.availableBackends = !!backends['data'] && backends['data'].reduce((acc, curr) => {
        acc[curr.backend] = curr;
        return acc;
      }, {});

      if (this.isLoading[CONFIG.AGENT_POLICY] === false) {
        this.onBackendSelected(this.agentPolicy.backend);
      }

      this.isLoading[CONFIG.BACKEND] = false;
    });
  }

  onBackendSelected(selectedBackend) {
    this.backend = this.availableBackends[selectedBackend];
    this.backend.config = {};

    // todo hardcoded for pktvisor
    this.getBackendData();
  }

  getBackendData() {
    Promise.all([this.getTaps(), this.getInputs(), this.getHandlers()])
      .then(value => {
        if (this.isEdit && this.agentPolicy) {
          const selected_tap = this.agentPolicy.policy.input.tap.name;
          this.tapFormGroup.patchValue({ selected_tap });
          this.tapFormGroup.controls.selected_tap.disable();
          this.onTapSelected(selected_tap);
          this.handlers = Object.entries(this.agentPolicy.handlers.modules)
            .map(([key, handler]) => ({ ...handler, name: key, type: handler.config.type }));
        }
      }, reason => console.warn(`Cannot retrieve backend data - reason: ${ JSON.parse(reason) }`))
      .catch(reason => {
        console.warn(`Cannot retrieve backend data - reason: ${ JSON.parse(reason) }`);
      });
  }

  getTaps() {
    return new Promise((resolve) => {
      this.isLoading[CONFIG.TAPS] = true;
      this.agentPoliciesService.getBackendConfig([this.backend.backend, 'taps'])
        .subscribe(taps => {
          this.availableTaps = !!taps['data'] && taps['data'].reduce((acc, curr) => {
            acc[curr.name] = curr;
            return acc;
          }, {});

          this.isLoading[CONFIG.TAPS] = false;

          resolve(this.availableTaps);
        });
    });
  }

  onTapSelected(selectedTap) {
    this.tap = this.availableTaps[selectedTap];

    const { input } = this.agentPolicy.policy;
    const { input_type, config_predefined } = this.tap;

    this.tap['config'] = {
      ...config_predefined.reduce(
        (acc, curr) => {
          acc[curr] = '';
          return acc;
        }, {}),
      ...input.config,
    };

    if (input_type) {
      this.onInputSelected(input_type);
    } else {
      this.input = null;
      this.tapFormGroup.controls.input_type.reset('');
    }
  }

  getInputs() {
    return new Promise((resolve) => {
      this.isLoading[CONFIG.INPUTS] = true;
      this.agentPoliciesService.getBackendConfig([this.backend.backend, 'inputs'])
        .subscribe(inputs => {
          this.availableInputs = !!inputs['data'] && inputs['data'];

          this.isLoading[CONFIG.INPUTS] = false;

          resolve(this.availableInputs);
        });
    });

  }

  onInputSelected(input_type) {
    this.input = this.availableInputs[input_type];

    this.tapFormGroup.patchValue({ input_type });

    // input type config model
    const { config: inputConfig } = this.input;
    // if editing, some values might not be overrideable any longer, all should be prefilled in form
    const agentConfig = !!this.isEdit ? this.agentPolicy.policy?.input?.config : null;
    // tap config values, cannot be overridden if set
    const preConfig = this.tap.config_predefined;
    // TODO this is under revision
    // TODO make code readable again
    // merge preconfigurations
    const finalConfig = {
      ...preConfig.reduce((acc, value) => {
        acc[value] = '';
        return acc;
      }, {}),
      ...agentConfig,
    };

    if (this.isEdit === false) {
      this.agentPolicy.policy = { input: '', config: '' };
    }
    // populate form controls
    const dynamicControls = Object.keys(inputConfig)
      .reduce((acc, key) => {
        const value = !!finalConfig?.[key] ? finalConfig[key] : '';
        const disabled = !!preConfig?.[key];
        acc[key] = [
          { value, disabled },
          inputConfig[key].required ? Validators.required : null,
        ];

        return acc;
      }, {});

    this.inputFormGroup = Object.keys(dynamicControls).length > 0 ? this._formBuilder.group(dynamicControls) : null;
  }

  getHandlers() {
    return new Promise((resolve) => {
      this.isLoading[CONFIG.HANDLERS] = true;

      this.agentPoliciesService.getBackendConfig([this.backend.backend, 'handlers'])
        .subscribe(handlers => {
          this.availableHandlers = !!handlers['data'] && handlers['data'];

          this.handlerSelectorFormGroup = this._formBuilder.group({
            'selected_handler': ['', [Validators.required]],
            'label': ['', [Validators.required]],
          });

          this.isLoading[CONFIG.HANDLERS] = false;
          resolve(this.availableBackends);
        });
    });
  }


  onHandlerSelected(selectedHandler) {
    const { config } = this.availableHandlers[selectedHandler];

    this.handlerSelectorFormGroup.controls.label.setValue('');

    const dynamicControls = Object.keys(config).reduce((acc, key) => {
      const field = config[key];
      acc[field.name] = [
        '',
        field.required ? Validators.required : null,
      ];
      return acc;
    }, Object.keys(config).length > 0 ? { 'selected_handler_config': ['', [Validators.required]] } : {});

    this.dynamicHandlerConfigFormGroup = Object.keys(dynamicControls).length > 0 ? this._formBuilder.group(dynamicControls) : null;

    this.liveHandler = !!this.availableHandlers[selectedHandler] ?
      { ...this.availableHandlers[selectedHandler], type: selectedHandler } : null;
  }

  onHandlerConfigSelected(selectedHandlerConfig) {
    this.selected_handler_config = selectedHandlerConfig !== '' ? selectedHandlerConfig : null;
  }

  onHandlerAdded() {
    let config = {};

    if (this.dynamicHandlerConfigFormGroup !== null) {
      config = {
        [this.selected_handler_config]: this.dynamicHandlerConfigFormGroup.controls[this.selected_handler_config].value,
      };
    }

    const handlerName = this.handlerSelectorFormGroup.controls.label.value;
    this.handlers.push({
      name: handlerName,
      type: this.liveHandler.type,
      config,
    });
  }

  onHandlerRemoved(selectedHandler) {
    delete this.handlers[selectedHandler];
  }

  goBack() {
    this.router.navigateByUrl('/pages/datasets/policies');
  }

  onFormSubmit() {
    const payload = {
      name: this.detailsFormGroup.controls.name.value,
      description: this.detailsFormGroup.controls.description.value,
      backend: this.detailsFormGroup.controls.backend.value,
      tags: {},
      version: !!this.isEdit && !!this.agentPolicy.version && this.agentPolicy.version || 1,
      policy: {
        kind: 'collection',
        input: {
          tap: this.tapFormGroup.controls.selected_tap.value,
          input_type: this.tapFormGroup.controls.input_type.value,
          config: Object.keys(this.inputFormGroup.controls)
            .map(key => ({ [key]: this.inputFormGroup.controls[key].value }))
            .reduce((acc, curr) => {
              for (const [key, value] of Object.entries(curr)) {
                if (!!value && value !== '') acc[key] = value;
              }
              return acc;
            }, {}),
        },
        handlers: {
          modules: this.handlers.reduce((acc, handler) => {
            acc[handler.name] = {
              version: '1.0',
              [Object.keys(handler.config).length > 0 ? 'config' : undefined]: handler.config,
              type: handler.type,
            };
            return acc;
          }, {}),
          config: {
            num_periods: 5,
            deep_sample_rate: 100,
          },
        },
      },
    };

    if (this.isEdit) {
      // updating existing sink
      this.agentPoliciesService.editAgentPolicy({ ...payload, id: this.agentPolicyID }).subscribe(() => {
        this.notificationsService.success('Agent Policy successfully updated', '');
        this.goBack();
      });
    } else {
      this.agentPoliciesService.addAgentPolicy(payload).subscribe(() => {
        this.notificationsService.success('Agent Policy successfully created', '');
        this.goBack();
      });
    }
  }
}
