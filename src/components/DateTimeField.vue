<script setup>
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { vi } from 'date-fns/locale'

// v-model là chuỗi ISO (hoặc null/''), bên trong chuyển qua lại với Date
const props = defineProps({
  modelValue: { type: String, default: null },
  label: { type: String, default: '' },
  minDate: { type: String, default: null },
  placeholder: { type: String, default: 'Chọn ngày và giờ' },
})
const emit = defineEmits(['update:modelValue'])

const date = computed({
  get: () => (props.modelValue ? new Date(props.modelValue) : null),
  set: (v) => emit('update:modelValue', v ? new Date(v).toISOString() : ''),
})
const min = computed(() => (props.minDate ? new Date(props.minDate) : undefined))
</script>

<template>
  <div class="field">
    <label v-if="label">{{ label }}</label>
    <VueDatePicker
      v-model="date"
      dark
      :locale="vi"
      :min-date="min"
      :placeholder="placeholder"
      :formats="{ input: 'HH:mm  dd/MM/yyyy' }"
      :time-config="{ is24: true, minutesIncrement: 1 }"
      :action-row="{ selectBtnLabel: 'Chọn', cancelBtnLabel: 'Hủy', nowBtnLabel: 'Bây giờ', showNow: true }"
      :week-start="1"
      :config="{ closeOnAutoApply: true }"
      teleport
      :clearable="true"
    />
  </div>
</template>
