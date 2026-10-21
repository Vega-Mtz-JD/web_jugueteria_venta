
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"delivery_zones": {
                  Row: {
                    "id": string,"is_active": boolean,"mode": Database["public"]['Enums']["zone_mode"],"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"mode": Database["public"]['Enums']["zone_mode"],"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"mode"?: Database["public"]['Enums']["zone_mode"],"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"manual_sales": {
                  Row: {
                    "channel": string,"created_at": string,"created_by": string,"id": string,"note": string | null,"product_id": string,"quantity": number,"request_id": string | null,"unit_price_cents": number,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"created_by": string,"id"?: string,"note"?: string | null,"product_id": string,"quantity": number,"request_id"?: string | null,"unit_price_cents": number,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"note"?: string | null,"product_id"?: string,"quantity"?: number,"request_id"?: string | null,"unit_price_cents"?: number,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "manual_sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manual_sales_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manual_sales_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_points": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string,"reference": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string,"reference"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string,"reference"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"audience": string,"created_at": string,"id": number,"kind": string,"last_error": string | null,"locked_until": string | null,"note": string | null,"order_id": string | null,"sent_at": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"audience": string,"created_at"?: string,"id"?: never,"kind": string,"last_error"?: string | null,"locked_until"?: string | null,"note"?: string | null,"order_id"?: string | null,"sent_at"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"audience"?: string,"created_at"?: string,"id"?: never,"kind"?: string,"last_error"?: string | null,"locked_until"?: string | null,"note"?: string | null,"order_id"?: string | null,"sent_at"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor": string,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"note": string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor"?: string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string | null,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"unit_price_cents": number
                  }
                  Update: {
                    "id"?: string,"order_id"?: string,"product_id"?: string,"product_name"?: string,"quantity"?: number,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": string | null,"address_reference": string | null,"city": string | null,"created_at": string,"customer_id": string,"delivery_fee_cents": number,"delivery_method": Database["public"]['Enums']["delivery_method"],"department": string | null,"id": string,"invoice_name": string | null,"invoice_nit": string | null,"invoice_requested": boolean,"meeting_point_custom": string | null,"meeting_point_id": string | null,"number": number,"phone": string,"recipient_ci": string | null,"recipient_name": string,"rejection_reason": string | null,"request_id": string,"shipping_agency": string | null,"shipping_proof_path": string | null,"status": Database["public"]['Enums']["order_status"],"status_changed_at": string,"submitted_at": string | null,"subtotal_cents": number,"total_cents": number,"tracking_code": string | null,"updated_at": string,"zone_id": string | null,"zone_mode": Database["public"]['Enums']["zone_mode"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"address_reference"?: string | null,"city"?: string | null,"created_at"?: string,"customer_id": string,"delivery_fee_cents": number,"delivery_method": Database["public"]['Enums']["delivery_method"],"department"?: string | null,"id"?: string,"invoice_name"?: string | null,"invoice_nit"?: string | null,"invoice_requested"?: boolean,"meeting_point_custom"?: string | null,"meeting_point_id"?: string | null,"number"?: number,"phone": string,"recipient_ci"?: string | null,"recipient_name": string,"rejection_reason"?: string | null,"request_id": string,"shipping_agency"?: string | null,"shipping_proof_path"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"status_changed_at"?: string,"submitted_at"?: string | null,"subtotal_cents": number,"total_cents": number,"tracking_code"?: string | null,"updated_at"?: string,"zone_id"?: string | null,"zone_mode"?: Database["public"]['Enums']["zone_mode"] | null
                  }
                  Update: {
                    "address"?: string | null,"address_reference"?: string | null,"city"?: string | null,"created_at"?: string,"customer_id"?: string,"delivery_fee_cents"?: number,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"department"?: string | null,"id"?: string,"invoice_name"?: string | null,"invoice_nit"?: string | null,"invoice_requested"?: boolean,"meeting_point_custom"?: string | null,"meeting_point_id"?: string | null,"number"?: number,"phone"?: string,"recipient_ci"?: string | null,"recipient_name"?: string,"rejection_reason"?: string | null,"request_id"?: string,"shipping_agency"?: string | null,"shipping_proof_path"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"status_changed_at"?: string,"submitted_at"?: string | null,"subtotal_cents"?: number,"total_cents"?: number,"tracking_code"?: string | null,"updated_at"?: string,"zone_id"?: string | null,"zone_mode"?: Database["public"]['Enums']["zone_mode"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_meeting_point_id_fkey"
      columns: ["meeting_point_id"]
isOneToOne: false
      referencedRelation: "meeting_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "delivery_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "account_holder": string | null,"id": string,"is_active": boolean,"name": string,"qr_path": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_holder"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"qr_path": string,"sort_order"?: number
                  }
                  Update: {
                    "account_holder"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"qr_path"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"payment_proofs": {
                  Row: {
                    "created_at": string,"id": string,"order_id": string,"path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"order_id": string,"path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"order_id"?: string,"path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_proofs_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"product_costs": {
                  Row: {
                    "initial_cost_cents": number,"product_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "initial_cost_cents": number,"product_id": string,"updated_at"?: string
                  }
                  Update: {
                    "initial_cost_cents"?: number,"product_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"id": string,"path": string,"product_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"id"?: string,"path": string,"product_id": string,"sort_order"?: number
                  }
                  Update: {
                    "alt"?: string | null,"id"?: string,"path"?: string,"product_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_id": string,"compare_at_cents": number | null,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"is_new": boolean,"is_sample": boolean,"max_players": number | null,"min_age": number | null,"min_players": number | null,"name": string,"price_cents": number,"search_text": string | null,"slug": string,"stock": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"compare_at_cents"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_new"?: boolean,"is_sample"?: boolean,"max_players"?: number | null,"min_age"?: number | null,"min_players"?: number | null,"name": string,"price_cents": number,"search_text"?: never,"slug": string,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"compare_at_cents"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_new"?: boolean,"is_sample"?: boolean,"max_players"?: number | null,"min_age"?: number | null,"min_players"?: number | null,"name"?: string,"price_cents"?: number,"search_text"?: never,"slug"?: string,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"purchase_items": {
                  Row: {
                    "id": string,"line_cost_cents": number | null,"product_id": string,"purchase_id": string,"quantity_ordered": number,"quantity_received": number | null,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"line_cost_cents"?: number | null,"product_id": string,"purchase_id": string,"quantity_ordered": number,"quantity_received"?: number | null,"unit_price_cents": number
                  }
                  Update: {
                    "id"?: string,"line_cost_cents"?: number | null,"product_id"?: string,"purchase_id"?: string,"quantity_ordered"?: number,"quantity_received"?: number | null,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchase_balances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_payments": {
                  Row: {
                    "amount_bob_cents": number,"amount_cents": number,"amount_purchase_cents": number,"created_at": string,"created_by": string | null,"currency": string,"id": string,"kind": string,"linked_payment_id": string | null,"note": string | null,"paid_on": string,"purchase_id": string,"rate": number | null,"request_id": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_bob_cents": number,"amount_cents": number,"amount_purchase_cents": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"kind"?: string,"linked_payment_id"?: string | null,"note"?: string | null,"paid_on"?: string,"purchase_id": string,"rate"?: number | null,"request_id"?: string | null,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_bob_cents"?: number,"amount_cents"?: number,"amount_purchase_cents"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"kind"?: string,"linked_payment_id"?: string | null,"note"?: string | null,"paid_on"?: string,"purchase_id"?: string,"rate"?: number | null,"request_id"?: string | null,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_payments_linked_payment_id_fkey"
      columns: ["linked_payment_id"]
isOneToOne: false
      referencedRelation: "purchase_payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_payments_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchase_balances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_payments_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    }
                  ]
                },"purchases": {
                  Row: {
                    "arrival_rate": number | null,"created_at": string,"created_by": string | null,"currency": string,"id": string,"issues_note": string | null,"note": string | null,"ordered_on": string,"received_at": string | null,"request_id": string,"shipping_cents": number | null,"status": string,"supplier_id": string,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival_rate"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"issues_note"?: string | null,"note"?: string | null,"ordered_on"?: string,"received_at"?: string | null,"request_id": string,"shipping_cents"?: number | null,"status"?: string,"supplier_id": string,"voided_at"?: string | null
                  }
                  Update: {
                    "arrival_rate"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"issues_note"?: string | null,"note"?: string | null,"ordered_on"?: string,"received_at"?: string | null,"request_id"?: string,"shipping_cents"?: number | null,"status"?: string,"supplier_id"?: string,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_costs": {
                  Row: {
                    "cost_origin": string | null,"created_at": string,"id": number,"manual_sale_id": string | null,"order_item_id": string | null,"product_id": string,"quantity": number,"source": string,"unit_cost_cents": number | null,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_origin"?: string | null,"created_at"?: string,"id"?: never,"manual_sale_id"?: string | null,"order_item_id"?: string | null,"product_id": string,"quantity": number,"source": string,"unit_cost_cents"?: number | null,"unit_price_cents": number
                  }
                  Update: {
                    "cost_origin"?: string | null,"created_at"?: string,"id"?: never,"manual_sale_id"?: string | null,"order_item_id"?: string | null,"product_id"?: string,"quantity"?: number,"source"?: string,"unit_cost_cents"?: number | null,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_costs_manual_sale_id_fkey"
      columns: ["manual_sale_id"]
isOneToOne: true
      referencedRelation: "manual_sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_costs_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: true
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "actor": string | null,"created_at": string,"delta": number,"id": number,"note": string | null,"product_id": string,"reason": string,"ref_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"delta": number,"id"?: never,"note"?: string | null,"product_id": string,"reason": string,"ref_id"?: string | null
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"delta"?: number,"id"?: never,"note"?: string | null,"product_id"?: string,"reason"?: string,"ref_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"store_settings": {
                  Row: {
                    "address": string | null,"delivery_fee_home_cents": number,"delivery_fee_meeting_cents": number,"id": number,"pickup_hours": string | null,"store_name": string,"tagline": string | null,"updated_at": string,"whatsapp_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"delivery_fee_home_cents"?: number,"delivery_fee_meeting_cents"?: number,"id"?: number,"pickup_hours"?: string | null,"store_name": string,"tagline"?: string | null,"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"delivery_fee_home_cents"?: number,"delivery_fee_meeting_cents"?: number,"id"?: number,"pickup_hours"?: string | null,"store_name"?: string,"tagline"?: string | null,"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"suppliers": {
                  Row: {
                    "contact_name": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"notes": string | null,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "contact_name"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "purchase_balances": {
                  Row: {
                    "currency": string | null,"debt_cents": number | null,"id": string | null,"paid_cents": number | null,"status": string | null,"supplier_id": string | null,"total_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "purchases_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_adjust_stock":
{ Args: { "p_delta": number,"p_product_id": string }; Returns: number
                           },
"admin_apply_credit":
{ Args: { "p_from_purchase_id": string,"p_rate": number,"p_request_id": string,"p_to_purchase_id": string }; Returns: undefined
                           },
"admin_correct_arrival":
{ Args: { "p_arrival_rate": number,"p_purchase_id": string,"p_received": Json,"p_shipping_cents": number }; Returns: undefined
                           },
"admin_count_shelf":
{ Args: { "p_counted": number,"p_product_id": string }; Returns: number
                           },
"admin_create_purchase":
{ Args: { "p_currency": string,"p_lines": Json,"p_note": string,"p_ordered_on": string,"p_request_id": string,"p_supplier_id": string }; Returns: string
                           },
"admin_customer_contact":
{ Args: { "p_order_id": string }; Returns: {
              "email": string,"full_name": string,"phone": string
            }[]
                           },
"admin_dashboard_sales":
{ Args: { "p_now"?: string,"p_period": string }; Returns: Json
                           },
"admin_dashboard_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_delete_product":
{ Args: { "p_product_id": string }; Returns: string
                           },
"admin_list_admins":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"id": string
            }[]
                           },
"admin_product_cost_summary":
{ Args: { "p_product_id": string }; Returns: Json
                           },
"admin_receive_purchase":
{ Args: { "p_arrival_rate": number,"p_purchase_id": string,"p_received": Json,"p_shipping_cents": number }; Returns: undefined
                           },
"admin_record_manual_sale":
{ Args: { "p_channel": string,"p_note"?: string,"p_product_id": string,"p_quantity": number,"p_request_id"?: string,"p_unit_price_cents": number }; Returns: string
                           },
"admin_record_payment":
{ Args: { "p_amount_cents": number,"p_currency": string,"p_kind"?: string,"p_note": string,"p_paid_on": string,"p_purchase_id": string,"p_rate": number,"p_request_id": string }; Returns: string
                           },
"admin_reserved_units":
{ Args: Record<PropertyKey, never>; Returns: {
              "product_id": string,"quantity": number
            }[]
                           },
"admin_sales_list":
{ Args: { "p_channel"?: string,"p_from"?: string,"p_limit"?: number,"p_period"?: string,"p_to"?: string,"p_without_cost"?: boolean }; Returns: Json
                           },
"admin_send_test_push":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"admin_set_admin":
{ Args: { "p_email": string,"p_make_admin": boolean }; Returns: undefined
                           },
"admin_set_initial_cost":
{ Args: { "p_cost_cents": number,"p_product_id": string }; Returns: undefined
                           },
"admin_set_order_status":
{ Args: { "p_expected_from": Database["public"]['Enums']["order_status"],"p_order_id": string,"p_rejection_reason"?: string,"p_shipping_agency"?: string,"p_shipping_proof_path"?: string,"p_to": Database["public"]['Enums']["order_status"],"p_tracking_code"?: string }; Returns: undefined
                           },
"admin_set_purchase_notes":
{ Args: { "p_issues_note": string,"p_note": string,"p_purchase_id": string }; Returns: undefined
                           },
"admin_update_purchase":
{ Args: { "p_currency": string,"p_lines": Json,"p_note": string,"p_ordered_on": string,"p_purchase_id": string,"p_supplier_id": string }; Returns: undefined
                           },
"admin_void_manual_sale":
{ Args: { "p_sale_id": string }; Returns: undefined
                           },
"admin_void_payment":
{ Args: { "p_payment_id": string }; Returns: undefined
                           },
"admin_void_purchase":
{ Args: { "p_purchase_id": string }; Returns: undefined
                           },
"apply_purchase_stock":
{ Args: { "p_deltas": Json,"p_purchase_id": string,"p_reason": string }; Returns: undefined
                           },
"cancel_order_by_customer":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"check_arrival_values":
{ Args: { "p_arrival_rate": number,"p_currency": string,"p_shipping_cents": number }; Returns: undefined
                           },
"check_purchase_header":
{ Args: { "p_currency": string,"p_supplier_id": string }; Returns: undefined
                           },
"claim_notifications":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"create_order":
{ Args: { "p_delivery": Json,"p_invoice": Json,"p_items": Json,"p_request_id": string }; Returns: {
              "order_id": string,"order_number": number
            }[]
                           },
"dashboard_buckets":
{ Args: { "p_now": string,"p_period": string }; Returns: {
              "b_from": string,"b_to": string,"idx": number,"kind": string
            }[]
                           },
"dashboard_period":
{ Args: { "p_now": string,"p_period": string }; Returns: {
              "cur_from": string,"cur_to": string,"list_from": string,"list_to": string,"prev_from": string,"prev_to": string
            }[]
                           },
"delete_sample_products":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"distribute_cents":
{ Args: { "p_ids": (string)[],"p_total": number,"p_weights": (number)[] }; Returns: (number)[]
                           },
"expire_orders":
{ Args: { "p_now"?: string }; Returns: number
                           },
"finish_notification":
{ Args: { "p_error": string,"p_id": number }; Returns: undefined
                           },
"immutable_unaccent":
{ Args: { "": string }; Returns: string
                           },
"insert_purchase_lines":
{ Args: { "p_lines": Json,"p_purchase_id": string }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"la_paz_start":
{ Args: { "p_day": string }; Returns: string
                           },
"next_free_product_slug":
{ Args: { "p_base": string }; Returns: string
                           },
"order_status_label":
{ Args: { "p_status": Database["public"]['Enums']["order_status"] }; Returns: string
                           },
"product_current_cost":
{ Args: { "p_product_id": string }; Returns: {
              "origin": string,"unit_cost_cents": number
            }[]
                           },
"purchase_effective_rate":
{ Args: { "p_purchase_id": string }; Returns: number
                           },
"read_received":
{ Args: { "p_purchase_id": string,"p_received": Json }; Returns: {
              "item_id": string,"previous": number,"product_id": string,"quantity": number
            }[]
                           },
"recompute_purchase_costs":
{ Args: { "p_purchase_id": string }; Returns: undefined
                           },
"require_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"reserved_units_of":
{ Args: { "p_product_id": string }; Returns: number
                           },
"restock_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"sales_lines":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "channel": string,"customer_id": string,"delivery_fee_cents": number,"manual_sale_id": string,"order_id": string,"order_number": number,"product_id": string,"product_name": string,"quantity": number,"sold_at": string,"unit_cost_cents": number,"unit_price_cents": number
            }[]
                           },
"sales_totals":
{ Args: { "p_channel"?: string,"p_from": string,"p_to": string,"p_without_cost"?: boolean }; Returns: Json
                           },
"set_stock_reason":
{ Args: { "p_note"?: string,"p_reason": string,"p_ref"?: string }; Returns: undefined
                           },
"slugify_name":
{ Args: { "p_name": string }; Returns: string
                           },
"submit_payment_proof":
{ Args: { "p_order_id": string,"p_path": string }; Returns: undefined
                           },
"wake_notifier":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "delivery_method": "recojo"|"envio_ciudad"|"encomienda","order_status": "esperando_pago"|"en_revision"|"pagado"|"enviado"|"listo_para_recoger"|"entregado"|"rechazado"|"cancelado"|"reembolsado","zone_mode": "domicilio"|"punto"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "delivery_method": ["recojo", "envio_ciudad", "encomienda"],"order_status": ["esperando_pago", "en_revision", "pagado", "enviado", "listo_para_recoger", "entregado", "rechazado", "cancelado", "reembolsado"],"zone_mode": ["domicilio", "punto"]
          }
        }
} as const
